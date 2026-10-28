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
import { useSimulatorWebSocket } from './services/useWebSocket';
import { apiService } from './services/api';
import { useAuth, UserSession } from './services/auth';

export function App() {
  const { isAuthenticated, user, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [simulatorStatus, setSimulatorStatus] = useState<string>('stopped');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { isConnected } = useSimulatorWebSocket();

  useEffect(() => {
    if (!isAuthenticated) return;
    const checkSimulator = async () => {
      try {
        const s = await apiService.getSimulatorStatus();
        setSimulatorStatus(s.status);
      } catch {
        setSimulatorStatus('stopped');
      }
    };
    checkSimulator();
    const interval = setInterval(checkSimulator, 4000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleGlobalRefresh = () => {
    setIsRefreshing(true);
    setRefreshTrigger((prev) => prev + 1);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleLoginSuccess = (session: UserSession) => {
    login(session);
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
          simulatorStatus={simulatorStatus}
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
    </div>
  );
}

export default App;
