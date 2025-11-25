import React, { useState } from 'react';
import { View } from '../types';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Calculator, 
  Image as ImageIcon, 
  Video, 
  MessageSquare,
  Menu,
  X,
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface LayoutProps {
  currentView: View;
  setView: (view: View) => void;
  children: React.ReactNode;
}

const NavItem = ({ view, current, label, icon: Icon, onClick, collapsed }: any) => (
  <button
    onClick={() => onClick(view)}
    title={collapsed ? label : ''}
    className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-lg transition-all duration-200 ${
      current === view 
        ? 'bg-primary text-slate-900 font-bold shadow-[0_0_15px_rgba(56,189,248,0.3)]' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    <Icon size={20} className={current === view ? 'text-slate-900' : ''} />
    {!collapsed && <span>{label}</span>}
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ currentView, setView, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar for Desktop */}
      <aside 
        className={`hidden md:flex flex-col border-r border-slate-800 bg-slate-950 transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        <div className={`p-6 border-b border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex items-center space-x-3 overflow-hidden">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-slate-900 shadow-lg shadow-primary/20 flex-shrink-0">
                  <Layers size={24} />
                </div>
                {!isSidebarCollapsed && (
                    <div className="whitespace-nowrap">
                       <span className="text-xl font-bold tracking-tight text-white block">Structura AI</span>
                       <span className="text-xs text-primary uppercase tracking-wider font-semibold">Estimator Pro</span>
                    </div>
                )}
            </div>
            {!isSidebarCollapsed && (
                <button 
                  onClick={() => setIsSidebarCollapsed(true)} 
                  className="text-slate-500 hover:text-white"
                >
                    <ChevronLeft size={20} />
                </button>
            )}
        </div>

        {/* Re-open button if collapsed */}
        {isSidebarCollapsed && (
            <div className="flex justify-center py-2 border-b border-slate-800">
                 <button 
                  onClick={() => setIsSidebarCollapsed(false)} 
                  className="text-slate-500 hover:text-white p-1"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        )}

        <nav className="flex-1 p-4 space-y-2">
          <NavItem view={View.DASHBOARD} current={currentView} label="Dashboard" icon={LayoutDashboard} onClick={setView} collapsed={isSidebarCollapsed} />
          <NavItem view={View.TAKEOFF} current={currentView} label="Plan Takeoff" icon={FileSpreadsheet} onClick={setView} collapsed={isSidebarCollapsed} />
          <NavItem view={View.ESTIMATOR} current={currentView} label="Estimator & Maps" icon={Calculator} onClick={setView} collapsed={isSidebarCollapsed} />
          <NavItem view={View.VISUALIZER} current={currentView} label="Visualizer" icon={ImageIcon} onClick={setView} collapsed={isSidebarCollapsed} />
          <NavItem view={View.SITE_VIDEO} current={currentView} label="Site Video" icon={Video} onClick={setView} collapsed={isSidebarCollapsed} />
          <NavItem view={View.CHAT} current={currentView} label="AI Consultant" icon={MessageSquare} onClick={setView} collapsed={isSidebarCollapsed} />
        </nav>
        <div className={`p-6 border-t border-slate-800 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
            <div className={`flex items-center space-x-2 text-xs text-slate-500 bg-slate-900 p-3 rounded-lg border border-slate-800 ${isSidebarCollapsed ? 'justify-center w-10 h-10 p-0' : ''}`}>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0"></div>
              {!isSidebarCollapsed && <span>System Online</span>}
            </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-slate-950 border-b border-slate-800 z-20 flex justify-between items-center p-4">
        <div className="flex items-center space-x-2">
           <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-slate-900">S</div>
           <span className="font-bold text-white">Structura AI</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-300">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-950 z-10 pt-20 md:hidden">
          <nav className="p-4 space-y-2">
             <NavItem view={View.DASHBOARD} current={currentView} label="Dashboard" icon={LayoutDashboard} onClick={(v: View) => {setView(v); setIsMobileMenuOpen(false)}} />
             <NavItem view={View.TAKEOFF} current={currentView} label="Plan Takeoff" icon={FileSpreadsheet} onClick={(v: View) => {setView(v); setIsMobileMenuOpen(false)}} />
             <NavItem view={View.ESTIMATOR} current={currentView} label="Estimator" icon={Calculator} onClick={(v: View) => {setView(v); setIsMobileMenuOpen(false)}} />
             <NavItem view={View.VISUALIZER} current={currentView} label="Visualizer" icon={ImageIcon} onClick={(v: View) => {setView(v); setIsMobileMenuOpen(false)}} />
             <NavItem view={View.SITE_VIDEO} current={currentView} label="Site Video" icon={Video} onClick={(v: View) => {setView(v); setIsMobileMenuOpen(false)}} />
             <NavItem view={View.CHAT} current={currentView} label="AI Consultant" icon={MessageSquare} onClick={(v: View) => {setView(v); setIsMobileMenuOpen(false)}} />
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-950 md:p-8 pt-20 p-4 relative">
        <div className="max-w-[1920px] mx-auto h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
};