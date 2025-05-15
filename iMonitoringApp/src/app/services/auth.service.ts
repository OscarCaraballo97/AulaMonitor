// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Storage } from '@ionic/storage-angular';
import { Observable, BehaviorSubject, from, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthRequest, AuthResponse, RegisterRequest } from '../models/auth.model';
import { Rol } from '../models/rol.model';
import { User } from '../models/user.model';
import { NavController } from '@ionic/angular';

const TOKEN_KEY = 'auth-token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private _storage: Storage | null = null;

  public isAuthenticated = new BehaviorSubject<boolean | null>(null);
  public currentUserRole = new BehaviorSubject<Rol | null>(null);
  public currentUser = new BehaviorSubject<User | null>(null);
  private currentToken = new BehaviorSubject<string | null>(null);

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private navCtrl: NavController
  ) {
    this.initStorage().then(() => this.loadToken());
  }

  private async initStorage() {
    // ... (como lo tenías)
    try {
      this._storage = await this.storage.create();
      console.log('AuthService: Storage inicializado.');
    } catch (error) {
      console.error('AuthService: Error inicializando Storage', error);
    }
  }

  async loadToken() {
    // ... (como lo tenías)
    if (!this._storage) {
      await this.initStorage();
      if (!this._storage) {
        console.error('AuthService: Storage no se pudo inicializar en loadToken.');
        this.setUnauthenticatedState();
        return;
      }
    }
    try {
      const token = await this._storage.get(TOKEN_KEY);
      console.log('[AuthService - loadToken] Token desde storage:', token);
      if (token) {
        this.processToken(token);
      } else {
        this.setUnauthenticatedState();
        console.log('[AuthService - loadToken] No hay token. Estado reiniciado.');
      }
    } catch (error) {
      console.error('[AuthService - loadToken] Error cargando token desde Storage', error);
      this.setUnauthenticatedState();
    }
  }

  private processToken(token: string) {
    this.currentToken.next(token);
    const decodedPayload = this.decodeTokenPayload(token);
    console.log('[AuthService - processToken] Payload decodificado:', decodedPayload);

    if (decodedPayload) {
      const role = this.parseRoleFromToken(decodedPayload);
      const userEmail = decodedPayload.sub; // Subject (email)
      const userName = decodedPayload.name || userEmail; // Nombre del claim 'name' o fallback a email
      const userId = decodedPayload.userId || decodedPayload.id || decodedPayload.jti; // <--- EXTRAER userId o id o jti

      console.log('[AuthService - processToken] Rol parseado:', role, '| Email (sub):', userEmail, '| UserID Claim:', userId);

      this.currentUserRole.next(role);
      const userFromToken: User = {
        id: userId, // <--- ASIGNAR EL ID EXTRAÍDO
        email: userEmail || 'Error al decodificar email',
        role: role || Rol.ESTUDIANTE, // Rol por defecto si no se puede parsear
        name: userName,
        avatarUrl: decodedPayload.avatarUrl || decodedPayload.picture || undefined,
      };
      this.currentUser.next(userFromToken);
      this.isAuthenticated.next(true);
      console.log('[AuthService - processToken] Estado actualizado: isAuthenticated=true. currentUserRole y currentUser emitidos:', userFromToken);
    } else {
      console.error('[AuthService - processToken] FALLÓ LA DECODIFICACIÓN DEL TOKEN o payload inválido.');
      this.clearAuthDataAndSetUnauthenticated();
    }
  }

  private decodeTokenPayload(token: string): any | null {
    // ... (como lo tenías)
    try {
      const payloadBase64Url = token.split('.')[1];
      if (!payloadBase64Url) {
        console.error('[AuthService - decodeTokenPayload] Token con formato inválido: falta payload.');
        return null;
      }
      const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
      const decodedJson = atob(payloadBase64);
      return JSON.parse(decodedJson);
    } catch (e) {
      console.error('[AuthService - decodeTokenPayload] Error al decodificar:', e);
      return null;
    }
  }

  private parseRoleFromToken(decodedPayload: any): Rol | null {
    // ... (como lo tenías)
    console.log("[AuthService - parseRoleFromToken] Intentando parsear rol desde payload:", decodedPayload);
    let roleString: string | undefined;
    if (decodedPayload.authorities && Array.isArray(decodedPayload.authorities) && decodedPayload.authorities.length > 0) {
      roleString = decodedPayload.authorities[0].toUpperCase().replace('ROLE_', '');
      console.log("[AuthService - parseRoleFromToken] Rol encontrado en claim 'authorities[0]':", roleString);
    } else if (decodedPayload.role && typeof decodedPayload.role === 'string') {
      roleString = decodedPayload.role.toUpperCase();
      console.log("[AuthService - parseRoleFromToken] Rol encontrado en claim 'role':", roleString);
    }

    if (roleString && (roleString in Rol)) {
      const parsed = Rol[roleString as keyof typeof Rol];
      console.log("[AuthService - parseRoleFromToken] Rol parseado exitosamente a enum:", parsed);
      return parsed;
    }
    console.warn('[AuthService - parseRoleFromToken] No se pudo parsear un rol válido. Payload:', decodedPayload);
    return null;
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    // ... (como lo tenías)
    console.log('[AuthService - register] Registrando con datos:', data);
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(
      tap(async (res) => {
        console.log('[AuthService - register] Respuesta del backend:', res);
        if (res && res.token && this._storage) {
          await this._storage.set(TOKEN_KEY, res.token);
          this.processToken(res.token);
        } else {
          console.warn('[AuthService - register] Respuesta de registro no contiene token.');
        }
      }),
      catchError(this.handleAuthError)
    );
  }

  login(credentials: AuthRequest): Observable<AuthResponse> {
    // ... (como lo tenías)
    console.log('[AuthService - login] Iniciando sesión con credenciales:', credentials);
    return this.http.post<AuthResponse>(`${this.apiUrl}/authenticate`, credentials).pipe(
      tap(async (res) => {
        console.log('[AuthService - login] Respuesta de autenticación backend:', res);
        if (res && res.token && this._storage) {
          await this._storage.set(TOKEN_KEY, res.token);
          this.processToken(res.token); // Esto ahora debería setear el ID del usuario
        } else {
          console.warn('[AuthService - login] Respuesta de login no contiene token.');
          this.setUnauthenticatedState();
        }
      }),
      catchError(this.handleAuthError)
    );
  }

  async logout() {
    // ... (como lo tenías)
    console.log('[AuthService - logout] Ejecutando logout.');
    await this.clearAuthDataAndSetUnauthenticated();
    this.navCtrl.navigateRoot('/login', { animated: true, animationDirection: 'back' });
    console.log('[AuthService - logout] Redirigido a /login.');
  }

  private async clearAuthDataAndSetUnauthenticated() {
    // ... (como lo tenías)
    if (!this._storage) await this.initStorage();
    await this._storage?.remove(TOKEN_KEY);
    this.setUnauthenticatedState();
    console.log('[AuthService - clearAuthDataAndSetUnauthenticated] Datos de autenticación limpiados.');
  }

  private setUnauthenticatedState() {
    // ... (como lo tenías)
    this.isAuthenticated.next(false);
    this.currentUserRole.next(null);
    this.currentUser.next(null);
    this.currentToken.next(null);
  }

  public updateCurrentUser(updatedUserData: Partial<User>) {
    // ... (como lo tenías)
    const current = this.currentUser.value;
    if (current) {
        this.currentUser.next({ ...current, ...updatedUserData });
        console.log('[AuthService - updateCurrentUser] currentUser actualizado:', this.currentUser.value);
    }
  }

  getIsAuthenticated(): Observable<boolean | null> { return this.isAuthenticated.asObservable(); }
  getCurrentUserRole(): Observable<Rol | null> { return this.currentUserRole.asObservable(); }
  getCurrentUser(): Observable<User | null> { return this.currentUser.asObservable(); }
  async getToken(): Promise<string | null> {
    // ... (como lo tenías)
    if (!this._storage) await this.initStorage();
    return this._storage ? this._storage.get(TOKEN_KEY) : null;
  }

  private handleAuthError = (error: HttpErrorResponse): Observable<never> => {
    // ... (como lo tenías)
    console.error('[AuthService - handleAuthError] API Error:', error);
    let userMessage = 'Error de autenticación o conexión con el servidor.';
    if (error.status === 0) { // net::ERR_CONNECTION_REFUSED u otros errores de red
        userMessage = 'No se pudo conectar con el servidor. Verifica tu conexión o que el servidor esté activo.';
    } else if (error.status === 401) { // Unauthorized
        userMessage = 'Credenciales incorrectas. Por favor, verifica tu correo y contraseña.';
    } else if (error.status === 403) { // Forbidden
        userMessage = 'No tienes permiso para acceder a este recurso.';
    } else if (error.error && typeof error.error.message === 'string') { // Mensaje de error específico del backend
        userMessage = error.error.message;
    } else if (typeof error.message === 'string' && error.status !== 0) {
        userMessage = error.message;
    }
    // Para errores 500, el mensaje genérico "Error de autenticación o conexión con el servidor." podría ser suficiente,
    // o podrías añadir un caso específico si el backend devuelve un JSON de error estándar.
    return throwError(() => new Error(userMessage));
  }
}
