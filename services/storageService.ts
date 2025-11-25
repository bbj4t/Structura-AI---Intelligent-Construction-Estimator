
import { Project, ProjectTemplate, EstimationItem } from '../types';

const KEYS = {
  TEMPLATES: 'structura_templates',
  PROJECTS: 'structura_projects',
  ACTIVE_PROJECT_ID: 'structura_active_project_id'
};

const DEFAULT_TEMPLATES: ProjectTemplate[] = [
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
];

export const storageService = {
  // Templates
  getTemplates: (): ProjectTemplate[] => {
    const stored = localStorage.getItem(KEYS.TEMPLATES);
    if (!stored) {
      localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(DEFAULT_TEMPLATES));
      return DEFAULT_TEMPLATES;
    }
    return JSON.parse(stored);
  },

  saveTemplates: (templates: ProjectTemplate[]) => {
    localStorage.setItem(KEYS.TEMPLATES, JSON.stringify(templates));
  },

  // Projects
  getProjects: (): Project[] => {
    const stored = localStorage.getItem(KEYS.PROJECTS);
    return stored ? JSON.parse(stored) : [];
  },

  saveProject: (project: Project) => {
    const projects = storageService.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    
    if (index >= 0) {
      projects[index] = { ...project, lastUpdated: new Date().toISOString() };
    } else {
      projects.push({ ...project, lastUpdated: new Date().toISOString() });
    }
    
    localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
  },

  // Active Project (Session)
  setActiveProjectId: (id: string | null) => {
    if (id) {
        localStorage.setItem(KEYS.ACTIVE_PROJECT_ID, id);
    } else {
        localStorage.removeItem(KEYS.ACTIVE_PROJECT_ID);
    }
  },

  getActiveProject: (): Project | null => {
    const id = localStorage.getItem(KEYS.ACTIVE_PROJECT_ID);
    if (!id) return null;
    const projects = storageService.getProjects();
    return projects.find(p => p.id === id) || null;
  },

  // Data Passing
  updateProjectItems: (projectId: string, items: EstimationItem[]) => {
    const projects = storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (project) {
        // Recalculate value based on items
        const totalValue = items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
        project.items = items;
        project.value = totalValue;
        project.lastUpdated = new Date().toISOString();
        localStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects));
    }
  }
};
