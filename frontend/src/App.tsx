import { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { SensorWaveBackground } from './components/decorations/SensorWaveBackground';
import { LoginPage } from './components/LoginPage';
import { OverviewPage } from './components/pages/OverviewPage';
import { LiveMonitoringPage } from './components/pages/LiveMonitoringPage';
import { SensorExplorerPage } from './components/pages/SensorExplorerPage';
import { AnomalyInvestigationPage } from './components/pages/AnomalyInvestigationPage';
import { DatasetExplorerPage } from './components/pages/DatasetExplorerPage';
import { ModelRegistryPage } from './components/pages/ModelRegistryPage';
import { SimulationControlCenterPage } from './components/pages/SimulationControlCenterPage';
import { ModelResearchLabPage } from './components/pages/ModelResearchLabPage';
import { ExperimentComparisonPage } from './components/pages/ExperimentComparisonPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { BroadcastModal, ReadinessState } from './components/BroadcastModal';
import { useSimulatorWebSocket } from './services/useWebSocket';
import { apiService } from './services/api';
import { useAuth, UserSession, BROADCAST_DISMISSED_KEY } from './services/auth';

export function App() {
  const { isAuthenticated, user, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [simulatorStatus, setSimulatorStatus] = useState<string>('stopped');
  const [isHardwareOnline, setIsHardwareOnline] = useState<boolean>(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false);
  const [backendReadiness, setBackendReadiness] = useState<ReadinessState>('connecting');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Post-login Broadcast Announcement Modal State (session-persisted)
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(BROADCAST_DISMISSED_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const { isConnected } = useSimulatorWebSocket();

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSystemHealth = async () => {
      try {
        const [h, r, s, dev] = await Promise.all([
          apiService.getHealth().catch(() => null),
          apiService.getReadiness().catch(() => null),
          apiService.getSimulatorStatus().catch(() => null),
          apiService.getDevicesStatus().catch(() => []),
        ]);

        const isBackendUp = h !== null && h.status === 'ok';
        const isDbUp = r?.components?.database?.ready === true;

        setIsBackendOnline(isBackendUp);
        if (isBackendUp && isDbUp) {
          setBackendReadiness('ready');
        } else if (isBackendUp && !isDbUp) {
          setBackendReadiness('waking_up');
        } else {
          setBackendReadiness('connecting');
        }

        // Check if physical ESP32 device is currently online (heartbeat <= 30 seconds)
        const espOnline = Array.isArray(dev) && dev.some(
          (d: any) => d.status === 'online' && (d.device_id?.startsWith('ESP32') || d.source === 'physical')
        );
        setIsHardwareOnline(espOnline);

        if (s) {
          setSimulatorStatus(s.status);
        } else {
          setSimulatorStatus('stopped');
        }
      } catch {
        setIsBackendOnline(false);
        setBackendReadiness('unavailable');
        setSimulatorStatus('stopped');
      }
    };

    checkSystemHealth();
    const interval = setInterval(checkSystemHealth, 8000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleGlobalRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleLoginSuccess = (session: UserSession) => {
    try {
      sessionStorage.removeItem(BROADCAST_DISMISSED_KEY);
    } catch {}
    setShowBroadcastModal(true);
    login(session);
  };

  const handleDismissBroadcast = () => {
    try {
      sessionStorage.setItem(BROADCAST_DISMISSED_KEY, 'true');
    } catch {}
    setShowBroadcastModal(false);
  };

  // If not authenticated, render the interactive Login Experience
  if (!isAuthenticated) {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  const renderActivePage = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPage key={refreshTrigger} />;
      case 'live':
        return <LiveMonitoringPage key={refreshTrigger} />;
      case 'sensors':
        return <SensorExplorerPage key={refreshTrigger} />;
      case 'anomalies':
        return <AnomalyInvestigationPage key={refreshTrigger} />;
      case 'datasets':
        return <DatasetExplorerPage key={refreshTrigger} />;
      case 'models':
        return <ModelRegistryPage key={refreshTrigger} />;
      case 'simulator':
        return <SimulationControlCenterPage key={refreshTrigger} />;
      case 'research':
        return <ModelResearchLabPage key={refreshTrigger} />;
      case 'experiments':
        return <ExperimentComparisonPage key={refreshTrigger} />;
      case 'reports':
        return <ReportsPage key={refreshTrigger} />;
      default:
        return <OverviewPage key={refreshTrigger} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-slate-800 overflow-hidden font-sans relative">
      {/* Signature Ambient Sensor Wave & Lattice Background */}
      <SensorWaveBackground opacity={0.65} />

      {/* Categorized Collapsible Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isWsConnected={isConnected}
        isBackendConnected={isBackendOnline}
        activeSimulatorStatus={simulatorStatus}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        onLogout={logout}
        userName={user?.userId}
      />

      {/* Main Technical Viewport Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative z-10">
        {/* Refined Industrial Top Header */}
        <Header
          activeTab={activeTab}
          isWsConnected={isConnected}
          isHardwareOnline={isHardwareOnline}
          backendReadiness={backendReadiness}
          onRefresh={handleGlobalRefresh}
          isRefreshing={isRefreshing}
          onLogout={logout}
          userName={user?.userId}
        />

        {/* Dynamic Page Container */}
        <main className="flex-1 p-5 sm:p-7 max-w-7xl w-full mx-auto">
          {renderActivePage()}
        </main>
      </div>

      {/* Post-Login Broadcast Announcement Modal */}
      <BroadcastModal
        isOpen={showBroadcastModal}
        onDismiss={handleDismissBroadcast}
      />
    </div>
  );
}

export default App;
