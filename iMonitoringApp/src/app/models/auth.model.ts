import { Rol } from './rol.model';
export interface AuthRequest { email: string; password?: string; }
export interface AuthResponse { token: string; }
export interface RegisterRequest { email: string; password?: string; role: Rol; }