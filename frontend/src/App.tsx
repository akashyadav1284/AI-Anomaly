import { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
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

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [simulatorStatus, setSimulatorStatus] = useState<string>('stopped');
  const { isConnected } = useSimulatorWebSocket();

  useEffect(() => {
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
  }, []);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPage />;
      case 'live':
        return <LiveMonitoringPage />;
      case 'sensors':
        return <SensorExplorerPage />;
      case 'anomalies':
        return <AnomalyInvestigationPage />;
      case 'datasets':
        return <DatasetExplorerPage />;
      case 'models':
        return <ModelRegistryPage />;
      case 'simulator':
        return <SimulationControlCenterPage />;
      case 'research':
        return <ModelResearchLabPage />;
      case 'experiments':
        return <ExperimentComparisonPage />;
      case 'reports':
        return <ReportsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="flex h-screen bg-[#070b14] text-slate-100 overflow-hidden font-sans selection:bg-blue-600/30">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isWsConnected={isConnected}
        activeSimulatorStatus={simulatorStatus}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Dashboard / {activeTab}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-slate-300 font-mono text-[11px]">RESEARCH MODE</span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Container */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
}

export default App;
