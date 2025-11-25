import React, { useState } from 'react';
import { View } from './types';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Takeoff } from './pages/Takeoff';
import { Estimator } from './pages/Estimator';
import { Visualizer } from './pages/Visualizer';
import { SiteVideo } from './pages/SiteVideo';
import { ChatWidget } from './components/ChatWidget';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);

  const renderView = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard setView={setCurrentView} />;
      case View.TAKEOFF:
        return <Takeoff />;
      case View.ESTIMATOR:
        return <Estimator />;
      case View.VISUALIZER:
        return <Visualizer />;
      case View.SITE_VIDEO:
        return <SiteVideo />;
      case View.CHAT:
        return (
            <div className="max-w-4xl mx-auto pt-4">
                <h1 className="text-2xl font-bold text-white mb-6">AI Consultant</h1>
                <ChatWidget />
            </div>
        );
      default:
        return <Dashboard setView={setCurrentView} />;
    }
  };

  return (
    <Layout currentView={currentView} setView={setCurrentView}>
      {renderView()}
    </Layout>
  );
};

export default App;