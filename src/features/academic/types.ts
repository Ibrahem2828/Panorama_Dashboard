export interface BaseEntity {
  id: number;
  name: string;
  code?: string;
  description?: string;
  order?: number;
  is_active?: boolean;
  created_at?: string;
}

export type University = BaseEntity;

export interface Faculty extends BaseEntity {
  university?: number | University;
}

export interface Major extends BaseEntity {
  faculty?: number | Faculty;
}

export interface AcademicYear extends BaseEntity {
  order: number;
}

export interface Semester extends BaseEntity {
  order: number;
}

export interface Subject extends BaseEntity {
  major?: number | Major;
  academic_year?: number | AcademicYear;
  semester?: number | Semester;
}

export type AcademicEntity = University | Faculty | Major | AcademicYear | Semester | Subject;

export interface AcademicFormValues {
  university?: string;
  faculty?: string;
  major?: string;
  academic_year?: string;
  semester?: string;
  name: string;
  code?: string;
  description?: string;
  order?: string;
  is_active: boolean;
}
