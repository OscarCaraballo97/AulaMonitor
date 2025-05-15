import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Reservation, ReservationStatus } from '../models/reservation.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ReservationService {
  private apiUrl = `${environment.apiUrl}/reservations`;
  private userApiUrl = `${environment.apiUrl}/users`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  private handleError(error: HttpErrorResponse, operation: string = 'operación de reserva') {
    let errorMessage = `Error en ${operation}: `;
    if (error.error instanceof ErrorEvent) {
      errorMessage += `Error: ${error.error.message}`;
    } else {
      
      const serverErrorMessage = error.error?.message || error.error?.error || error.message;
      errorMessage += `Código ${error.status}, mensaje: ${serverErrorMessage || 'Error del servidor desconocido'}`;
      if (error.status === 0) {
        errorMessage = `Error de red o CORS. No se pudo conectar con el servidor para ${operation}.`;
      }
    }
    console.error(errorMessage, error); 
    return throwError(() => new Error(errorMessage));
  }

  getAllReservations(filters?: { classroomId?: string, userId?: string, status?: ReservationStatus }): Observable<Reservation[]> {
    let params = new HttpParams();
    if (filters?.classroomId) {
      params = params.set('classroomId', filters.classroomId);
    }
    if (filters?.userId) {
      params = params.set('userId', filters.userId);
    }
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    return this.http.get<Reservation[]>(this.apiUrl, { params })
      .pipe(catchError(err => this.handleError(err, 'obtener todas las reservas')));
  }

  getReservationById(id: string): Observable<Reservation> {
    return this.http.get<Reservation>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `obtener reserva por ID ${id}`)));
  }

  createReservation(reservationData: Omit<Reservation, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'user' | 'classroom'>): Observable<Reservation> {
    return this.http.post<Reservation>(this.apiUrl, reservationData)
      .pipe(catchError(err => this.handleError(err, 'crear reserva')));
  }

  updateReservation(id: string, reservationData: Partial<Omit<Reservation, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'classroom'>>): Observable<Reservation> {
    return this.http.put<Reservation>(`${this.apiUrl}/${id}`, reservationData)
      .pipe(catchError(err => this.handleError(err, `actualizar reserva ${id}`)));
  }

  updateReservationStatus(id: string, status: ReservationStatus): Observable<Reservation> {

    let params = new HttpParams().set('status', status.toString());
    return this.http.put<Reservation>(`${this.apiUrl}/${id}/status`, null, { params }) 
      .pipe(catchError(err => this.handleError(err, `actualizar estado de reserva ${id}`)));
  }

  cancelMyReservation(id: string): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.apiUrl}/${id}/cancel`, {})
      .pipe(catchError(err => this.handleError(err, `cancelar mi reserva ${id}`)));
  }


  deleteReservation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(catchError(err => this.handleError(err, `eliminar reserva ${id}`)));
  }

  getUpcomingReservations(limit: number = 5): Observable<Reservation[]> {
    const params = new HttpParams()
      .set('status', ReservationStatus.CONFIRMADA)
      .set('sort', 'startTime,asc')
      .set('limit', limit.toString())
      .set('futureOnly', 'true');
    return this.http.get<Reservation[]>(this.apiUrl, { params })
      .pipe(catchError(err => this.handleError(err, 'obtener próximas reservas (general)')));
  }

  getMyUpcomingReservations(limit: number = 3): Observable<Reservation[]> {
    const url = `${this.userApiUrl}/me/reservations`;
    const params = new HttpParams()
      .set('status', ReservationStatus.CONFIRMADA.toString())
      .set('sort', 'startTime,asc')
      .set('limit', limit.toString())
      .set('futureOnly', 'true');
    return this.http.get<Reservation[]>(url, { params })
      .pipe(catchError(err => this.handleError(err, 'obtener mis próximas reservas')));
  }
}
