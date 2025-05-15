// src/app/models/classroom.model.ts
import { Building } from './building.model';
import { ClassroomType } from './classroom-type.enum'; // <--- ASEGÚRATE QUE IMPORTA DESDE EL ARCHIVO CORRECTO

export interface Classroom {
  id?: string;
  name: string;
  capacity: number;
  type: ClassroomType; // Usa el enum importado
  resources?: string;
  buildingId: string;
  building?: Building;
}
