
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Building } from '../models/building.model';
import { Classroom } from '../models/classroom.model';

@Injectable({
  providedIn: 'root'
})
export class BuildingService {
  private apiUrl = `${environment.apiUrl}/buildings`;

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse, operation: string = 'operación') {
    let errorMessage = `Error en ${operation}: `;
    if (error.error instanceof ErrorEvent) {

      errorMessage += `Error: ${error.error.message}`;
    } else {

      errorMessage += `Código ${error.status}, mensaje: ${error.message || error.error?.message || 'Error del servidor'}`;
    }
    console.error(errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }

  getAllBuildings(): Observable<Building[]> {
    return this.http.get<Building[]>(this.apiUrl)
      .pipe(catchError(err => this.handleError(err, 'obtener todos los edificios')));
  }

  getBuildingById(id: string): Observable<Building> {
    return this.http.get<Building>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `obtener edificio por ID ${id}`)));
  }

  createBuilding(building: Building): Observable<Building> {
    return this.http.post<Building>(this.apiUrl, building)
      .pipe(catchError(err => this.handleError(err, 'crear edificio')));
  }

  updateBuilding(id: string, building: Building): Observable<Building> {
    return this.http.put<Building>(`${this.apiUrl}/${id}`, building)
      .pipe(catchError(err => this.handleError(err, `actualizar edificio ${id}`)));
  }

  deleteBuilding(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `eliminar edificio ${id}`)));
  }

  getClassroomsByBuilding(buildingId: string): Observable<Classroom[]> {
    return this.http.get<Classroom[]>(`${this.apiUrl}/${buildingId}/classrooms`)
      .pipe(catchError(err => this.handleError(err, `obtener aulas para edificio ${buildingId}`)));
  }
}