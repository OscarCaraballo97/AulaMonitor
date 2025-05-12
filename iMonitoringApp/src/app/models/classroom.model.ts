
export enum ClassroomType {
    AULA = 'AULA', LABORATORIO = 'LABORATORIO', AUDITORIO = 'AUDITORIO'
}
export interface Classroom {
    id?: string; name: string; capacity: number; type: ClassroomType;
    resources?: string; buildingId?: string;
}