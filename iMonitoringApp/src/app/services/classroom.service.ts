
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Classroom } from '../models/classroom.model'; 
import { ClassroomType } from '../models/classroom-type.enum'; 
import { Reservation } from '../models/reservation.model';

export interface ClassroomAvailabilitySummary {
  availableNow: number;
  occupiedNow: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClassroomService {
  private apiUrl = `${environment.apiUrl}/classrooms`;

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse, operation: string = 'operación de aula') {
    let errorMessage = `Error en ${operation}: `;
    if (error.error instanceof ErrorEvent) {
      errorMessage += `Error: ${error.error.message}`;
    } else {
      errorMessage += `Código ${error.status}, mensaje: ${error.error?.message || error.message || 'Error del servidor'}`;
    }
    console.error(errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }

  getAllClassrooms(): Observable<Classroom[]> {
    return this.http.get<Classroom[]>(this.apiUrl)
      .pipe(catchError(err => this.handleError(err, 'obtener todas las aulas')));
  }

  getClassroomById(id: string): Observable<Classroom> {
    return this.http.get<Classroom>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `obtener aula por ID ${id}`)));
  }

  createClassroom(classroom: Classroom): Observable<Classroom> {
    return this.http.post<Classroom>(this.apiUrl, classroom)
      .pipe(catchError(err => this.handleError(err, 'crear aula')));
  }

  updateClassroom(id: string, classroom: Classroom): Observable<Classroom> {
    return this.http.put<Classroom>(`${this.apiUrl}/${id}`, classroom)
      .pipe(catchError(err => this.handleError(err, `actualizar aula ${id}`)));
  }

  deleteClassroom(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `eliminar aula ${id}`)));
  }

  getAvailabilitySummary(): Observable<ClassroomAvailabilitySummary> {
    return this.http.get<ClassroomAvailabilitySummary>(`${this.apiUrl}/stats/availability`)
      .pipe(catchError(err => this.handleError(err, 'obtener resumen de disponibilidad')));
  }

  getClassroomsByBuildingId(buildingId: string): Observable<Classroom[]> {
    const params = new HttpParams().set('buildingId', buildingId);
    return this.http.get<Classroom[]>(this.apiUrl, { params })
        .pipe(catchError(err => this.handleError(err, `obtener aulas para edificio ${buildingId}`)));
  }
  

  getClassroomsByType(type: ClassroomType): Observable<Classroom[]> {
    return this.http.get<Classroom[]>(`${this.apiUrl}/type/${type}`)
      .pipe(catchError(err => this.handleError(err, `obtener aulas por tipo ${type}`)));
  }
  getClassroomReservations(classroomId: string, start: string, end: string): Observable<Reservation[]> {
    const params = new HttpParams()
      .set('start', start)
      .set('end', end)
      .set('status', 'CONFIRMADA'); 

    return this.http.get<Reservation[]>(`${this.apiUrl}/${classroomId}/reservations`, { params })
      .pipe(catchError(err => this.handleError(err, `obtener reservas para aula ${classroomId}`)));
  }
}
