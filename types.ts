
export enum View {
  DASHBOARD = 'DASHBOARD',
  TAKEOFF = 'TAKEOFF',
  ESTIMATOR = 'ESTIMATOR',
  VISUALIZER = 'VISUALIZER',
  SITE_VIDEO = 'SITE_VIDEO',
  CHAT = 'CHAT'
}

export enum ImageAspectRatio {
  SQUARE = '1:1',
  PORTRAIT_2_3 = '2:3',
  LANDSCAPE_3_2 = '3:2',
  PORTRAIT_3_4 = '3:4',
  LANDSCAPE_4_3 = '4:3',
  PORTRAIT_9_16 = '9:16',
  LANDSCAPE_16_9 = '16:9',
  WIDE_21_9 = '21:9'
}

export enum ImageSize {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
  isLoading?: boolean;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
        reviewSnippets?: {
            snippet?: string;
        }[]
    }
  };
}

export interface EstimationItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  category: string;
  notes?: string;
}

export interface TakeoffCategory {
  name: string; // e.g., "Counts", "Linear", "Areas"
  items: EstimationItem[];
}

export interface TakeoffData {
  summary: string;
  items: EstimationItem[]; // Flattened list for the table
  rawAnalysis: string;
}

export interface Project {
  id: string;
  name: string;
  address: string;
  status: 'Bidding' | 'In Progress' | 'Won' | 'Lost';
  dueDate: string;
  value: number;
  progress: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  defaultScopes: string[];
  commonItems: string[];
}

export const CSI_DIVISIONS = [
  "01 - General Requirements",
  "02 - Existing Conditions",
  "03 - Concrete",
  "04 - Masonry",
  "05 - Metals",
  "06 - Wood, Plastics, Composites",
  "07 - Thermal & Moisture Protection",
  "08 - Openings",
  "09 - Finishes",
  "10 - Specialties",
  "11 - Equipment",
  "12 - Furnishings",
  "13 - Special Construction",
  "14 - Conveying Equipment",
  "21 - Fire Suppression",
  "22 - Plumbing",
  "23 - HVAC",
  "26 - Electrical",
  "27 - Communications",
  "28 - Electronic Safety & Security",
  "31 - Earthwork",
  "32 - Exterior Improvements",
  "33 - Utilities"
];