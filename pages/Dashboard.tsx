
import React, { useState } from 'react';
import { View, Project, ProjectTemplate, CSI_DIVISIONS } from '../types';
import { Plus, ArrowRight, Search, Folder, MoreVertical, Calendar, DollarSign, PieChart, LayoutTemplate, Trash2, Check, X, CheckSquare, Square, Save } from 'lucide-react';
import { formatCurrency } from '../services/utils';

interface DashboardProps {
  setView: (view: View) => void;
}

const ProjectRow: React.FC<{ project: Project; onClick: () => void }> = ({ project, onClick }) => (
  <tr onClick={onClick} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer group">
    <td className="px-6 py-4">
      <div className="flex items-center">
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mr-4 text-primary group-hover:bg-primary group-hover:text-slate-900 transition-colors">
          <Folder size={20} />
        </div>
        <div>
          <div className="font-bold text-white">{project.name}</div>
          <div className="text-xs text-slate-500">{project.address}</div>
        </div>
      </div>
    </td>
    <td className="px-6 py-4">
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
        project.status === 'Won' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
        project.status === 'In Progress' ? 'bg-primary/10 text-primary border-primary/20' :
        project.status === 'Bidding' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
        'bg-red-500/10 text-red-400 border-red-500/20'
      }`}>
        {project.status}
      </span>
    </td>
    <td className="px-6 py-4 text-slate-300 text-sm">
      {project.dueDate}
    </td>
    <td className="px-6 py-4 text-white font-mono text-sm">
      {formatCurrency(project.value)}
    </td>
    <td className="px-6 py-4">
       <div className="w-full bg-slate-800 rounded-full h-2 max-w-[100px]">
          <div className="bg-primary h-2 rounded-full" style={{ width: `${project.progress}%` }}></div>
       </div>
       <span className="text-xs text-slate-500 mt-1 block">{project.progress}% Complete</span>
    </td>
    <td className="px-6 py-4 text-right">
      <button className="text-slate-400 hover:text-white p-2">
        <MoreVertical size={16} />
      </button>
    </td>
  </tr>
);

export const Dashboard: React.FC<DashboardProps> = ({ setView }) => {
  const [projects] = useState<Project[]>([
    { id: '1', name: 'Lakeside Office Complex', address: '1200 Riverside Dr, Austin, TX', status: 'In Progress', dueDate: 'Oct 24, 2025', value: 4500000, progress: 35 },
    { id: '2', name: 'Downtown Renovation', address: '400 Main St, Chicago, IL', status: 'Bidding', dueDate: 'Nov 01, 2025', value: 1200000, progress: 10 },
    { id: '3', name: 'Westside Apartments', address: '890 Pine Ave, Seattle, WA', status: 'Won', dueDate: 'Sep 15, 2025', value: 8750000, progress: 0 },
    { id: '4', name: 'Harbor Retail Center', address: '55 Ocean Blvd, Miami, FL', status: 'Lost', dueDate: 'Aug 30, 2025', value: 3200000, progress: 100 },
  ]);

  // Template Management State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([
    {
      id: 'default-1',
      name: 'Commercial Office Shell',
      description: 'Standard setup for office shell & core projects. Focus on concrete, steel, and exterior framing.',
      defaultScopes: ['03 - Concrete', '04 - Masonry', '05 - Metals', '08 - Openings'],
      commonItems: ['3000psi Concrete Slab', 'Steel Columns W12x40', 'Exterior Glazing System']
    },
    {
      id: 'default-2',
      name: 'Residential Interior',
      description: 'Interior renovation template for multi-family units.',
      defaultScopes: ['09 - Finishes', '06 - Wood, Plastics, Composites', '08 - Openings', '12 - Furnishings'],
      commonItems: ['5/8" Drywall Type X', 'Interior Paint (Eggshell)', 'LVT Flooring', 'Baseboard 4"']
    }
  ]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<ProjectTemplate>({
    id: '', name: '', description: '', defaultScopes: [], commonItems: []
  });
  const [newItemText, setNewItemText] = useState('');

  const handleOpenTemplates = () => {
    setShowTemplateModal(true);
    if (templates.length > 0) {
       selectTemplate(templates[0]);
    } else {
       startNewTemplate();
    }
  };

  const selectTemplate = (tmpl: ProjectTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setTemplateForm({ ...tmpl });
  };

  const startNewTemplate = () => {
    setSelectedTemplateId(null);
    setTemplateForm({
      id: `tmpl-${Date.now()}`,
      name: 'New Template',
      description: '',
      defaultScopes: [],
      commonItems: []
    });
  };

  const toggleFormScope = (scope: string) => {
    setTemplateForm(prev => {
      if (prev.defaultScopes.includes(scope)) {
        return { ...prev, defaultScopes: prev.defaultScopes.filter(s => s !== scope) };
      } else {
        return { ...prev, defaultScopes: [...prev.defaultScopes, scope] };
      }
    });
  };

  const addCommonItem = () => {
    if (newItemText.trim()) {
      setTemplateForm(prev => ({
        ...prev,
        commonItems: [...prev.commonItems, newItemText.trim()]
      }));
      setNewItemText('');
    }
  };

  const removeCommonItem = (index: number) => {
    setTemplateForm(prev => ({
      ...prev,
      commonItems: prev.commonItems.filter((_, i) => i !== index)
    }));
  };

  const saveTemplate = () => {
    if (!templateForm.name) return;
    
    setTemplates(prev => {
      const exists = prev.find(t => t.id === templateForm.id);
      if (exists) {
        return prev.map(t => t.id === templateForm.id ? templateForm : t);
      } else {
        return [...prev, templateForm];
      }
    });
    setSelectedTemplateId(templateForm.id);
  };

  const deleteTemplate = (id: string) => {
    const newTemplates = templates.filter(t => t.id !== id);
    setTemplates(newTemplates);
    if (newTemplates.length > 0) {
      selectTemplate(newTemplates[0]);
    } else {
      startNewTemplate();
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex items-center justify-between">
           <div>
             <p className="text-slate-400 text-sm font-medium mb-1">Total Pipeline</p>
             <h2 className="text-2xl font-bold text-white">$17.6M</h2>
           </div>
           <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
             <DollarSign size={24} />
           </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex items-center justify-between">
           <div>
             <p className="text-slate-400 text-sm font-medium mb-1">Active Bids</p>
             <h2 className="text-2xl font-bold text-white">12</h2>
           </div>
           <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-400">
             <PieChart size={24} />
           </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex items-center justify-between">
           <div>
             <p className="text-slate-400 text-sm font-medium mb-1">Win Rate</p>
             <h2 className="text-2xl font-bold text-white">34%</h2>
           </div>
           <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center text-green-400">
             <ArrowRight size={24} className="-rotate-45"/>
           </div>
        </div>
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex items-center justify-between">
           <div>
             <p className="text-slate-400 text-sm font-medium mb-1">Upcoming Deadlines</p>
             <h2 className="text-2xl font-bold text-white">3</h2>
           </div>
           <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-400">
             <Calendar size={24} />
           </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">Project List</h1>
        <div className="flex gap-3 w-full md:w-auto">
           <div className="relative flex-1 md:w-64">
             <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
             <input type="text" placeholder="Search projects..." className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary" />
           </div>
           
           <button 
             onClick={handleOpenTemplates}
             className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg flex items-center font-medium border border-slate-700 transition-all whitespace-nowrap"
           >
             <LayoutTemplate size={18} className="mr-2" /> Templates
           </button>

           <button 
            onClick={() => setView(View.TAKEOFF)}
            className="bg-primary hover:bg-sky-400 text-slate-900 px-4 py-2 rounded-lg flex items-center font-bold shadow-lg shadow-primary/20 transition-all whitespace-nowrap"
          >
            <Plus size={18} className="mr-2" /> New Project
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4 font-semibold">Project Name</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Due Date</th>
                <th className="px-6 py-4 font-semibold">Value</th>
                <th className="px-6 py-4 font-semibold">Progress</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <ProjectRow key={p.id} project={p} onClick={() => setView(View.TAKEOFF)} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 bg-slate-950">
          <span>Showing 4 of 12 projects</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-slate-900 rounded border border-slate-800 hover:text-white">Previous</button>
            <button className="px-3 py-1 bg-slate-900 rounded border border-slate-800 hover:text-white">Next</button>
          </div>
        </div>
      </div>

      {/* Template Management Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
           <div className="bg-slate-900 w-full max-w-5xl h-[80vh] rounded-2xl border border-slate-800 shadow-2xl flex overflow-hidden">
              
              {/* Sidebar List */}
              <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
                 <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-white">Templates</h3>
                    <button onClick={startNewTemplate} className="p-1 hover:bg-slate-800 rounded text-primary">
                       <Plus size={18} />
                    </button>
                 </div>
                 <div className="flex-1 overflow-y-auto">
                    {templates.map(tmpl => (
                       <div 
                          key={tmpl.id}
                          onClick={() => selectTemplate(tmpl)}
                          className={`p-3 border-b border-slate-900 cursor-pointer hover:bg-slate-900 transition-colors ${selectedTemplateId === tmpl.id ? 'bg-slate-900 border-l-2 border-l-primary' : 'text-slate-400'}`}
                       >
                          <div className={`font-medium text-sm ${selectedTemplateId === tmpl.id ? 'text-white' : ''}`}>{tmpl.name}</div>
                          <div className="text-xs text-slate-600 truncate">{tmpl.description || 'No description'}</div>
                       </div>
                    ))}
                 </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 flex flex-col bg-slate-900">
                 <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                    <h2 className="text-lg font-bold text-white flex items-center">
                       <LayoutTemplate className="mr-2 text-slate-400" size={20}/>
                       {selectedTemplateId ? 'Edit Template' : 'New Template'}
                    </h2>
                    <div className="flex space-x-2">
                       {selectedTemplateId && (
                          <button onClick={() => deleteTemplate(selectedTemplateId)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded">
                             <Trash2 size={18} />
                          </button>
                       )}
                       <button onClick={() => setShowTemplateModal(false)} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded">
                          <X size={20} />
                       </button>
                    </div>
                 </div>

                 <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-4">
                          <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Template Name</label>
                             <input 
                                type="text"
                                value={templateForm.name}
                                onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-primary focus:outline-none"
                                placeholder="e.g. Retail Shell"
                             />
                          </div>
                          <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                             <textarea 
                                value={templateForm.description}
                                onChange={(e) => setTemplateForm({...templateForm, description: e.target.value})}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-primary focus:outline-none h-24 resize-none"
                                placeholder="Describe the purpose of this template..."
                             />
                          </div>
                          
                          <div>
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Common Items (Always Included)</label>
                             <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 max-h-48 overflow-y-auto space-y-2 mb-2">
                                {templateForm.commonItems.map((item, i) => (
                                   <div key={i} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800">
                                      <span className="text-sm text-slate-300">{item}</span>
                                      <button onClick={() => removeCommonItem(i)} className="text-slate-600 hover:text-red-400"><X size={14}/></button>
                                   </div>
                                ))}
                                {templateForm.commonItems.length === 0 && <p className="text-xs text-slate-600 p-2 text-center">No common items added.</p>}
                             </div>
                             <div className="flex gap-2">
                                <input 
                                   type="text"
                                   value={newItemText}
                                   onChange={(e) => setNewItemText(e.target.value)}
                                   onKeyDown={(e) => e.key === 'Enter' && addCommonItem()}
                                   className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                                   placeholder="Add item..."
                                />
                                <button onClick={addCommonItem} className="bg-slate-800 text-white px-3 rounded-lg hover:bg-slate-700"><Plus size={16}/></button>
                             </div>
                          </div>
                       </div>

                       <div className="h-full flex flex-col">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Default Scopes (CSI Divisions)</label>
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex-1 overflow-y-auto">
                              <div className="space-y-1">
                                 {CSI_DIVISIONS.map(div => (
                                    <button 
                                       key={div}
                                       onClick={() => toggleFormScope(div)}
                                       className={`w-full flex items-center p-2 rounded text-left text-sm transition-colors ${templateForm.defaultScopes.includes(div) ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-900'}`}
                                    >
                                       {templateForm.defaultScopes.includes(div) ? <CheckSquare size={16} className="mr-2 flex-shrink-0" /> : <Square size={16} className="mr-2 flex-shrink-0"/>}
                                       <span className="truncate">{div}</span>
                                    </button>
                                 ))}
                              </div>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
                    <button 
                       onClick={saveTemplate}
                       className="bg-primary text-slate-900 px-6 py-2.5 rounded-lg font-bold flex items-center hover:bg-sky-400 transition-colors"
                    >
                       <Save size={18} className="mr-2" /> Save Template
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
