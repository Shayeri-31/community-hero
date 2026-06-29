export interface UserInfo {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type ReportCategory = 'pothole' | 'broken streetlight' | 'water leak' | 'garbage issue' | 'other';

export type ReportSeverity = 'low' | 'medium' | 'high';

export type ReportStatus = 'Reported' | 'Verified' | 'Fixed';

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

export interface Report {
  id: string;
  photo: string; // Base64 JPEG string
  category: ReportCategory;
  severity: ReportSeverity;
  description: string;
  status: ReportStatus;
  location: LocationData;
  reportedBy: UserInfo;
  createdAt: { seconds: number; nanoseconds: number } | any; // Firestore Timestamp
  confirmedBy: string[]; // UIDs of users who confirmed this report is real
  videoUrl?: string;
}

export interface DashboardStats {
  reported: number;
  verified: number;
  fixed: number;
}

export interface Contributor {
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string | null;
  points: number;
  updatedAt?: any;
}

