import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Building } from '../models/building.model';
import { Classroom } from '../models/classroom.model';


@Injectable({
  providedIn: 'root'
})
export class BuildingService {
  private apiUrl = environment.apiUrl + '/buildings';

  constructor(private http: HttpClient) { }

  getAllBuildings(): Observable<Building[]> {
    return this.http.get<Building[]>(this.apiUrl);
  }

  getBuildingById(id: string): Observable<Building> {
    return this.http.get<Building>(`<span class="math-inline">\{this\.apiUrl\}/</span>{id}`);
  }

  createBuilding(building: Building): Observable<Building> {
    return this.http.post<Building>(this.apiUrl, building);
  }

  updateBuilding(id: string, building: Building): Observable<Building> {
    return this.http.put<Building>(`<span class="math-inline">\{this\.apiUrl\}/</span>{id}`, building);
  }

  deleteBuilding(id: string): Observable<void> {
    return this.http.delete<void>(`<span class="math-inline">\{this\.apiUrl\}/</span>{id}`);
  }

  getClassroomsByBuilding(id: string): Observable<Classroom[]> {
    return this.http.get<Classroom[]>(`<span class="math-inline">\{this\.apiUrl\}/</span>{id}/classrooms`);
  }
}