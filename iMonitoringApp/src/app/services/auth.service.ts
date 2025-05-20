import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Storage } from '@ionic/storage-angular';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthRequest, AuthResponse, RegisterRequest } from '../models/auth.model';
import { Rol } from '../models/rol.model';
import { User } from '../models/user.model';
import { NavController } from '@ionic/angular';

const TOKEN_KEY = 'auth-token'; 

declare var atob: any; 

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
    this.initStorageAndLoadToken();
  }

  private async initStorageAndLoadToken() {
    await this.initStorage();
    if (this._storage) {
      await this.loadToken();
    } else {
      console.error('AuthService: Storage no disponible al inicio, no se puede cargar token.');
      this.setUnauthenticatedState();
    }
  }

  private async initStorage() {
    if (this._storage) {
        return;
    }
    try {
      this._storage = await this.storage.create();
      console.log('AuthService: Storage inicializado correctamente.');
    } catch (error) {
      console.error('AuthService: Error CRÍTICO inicializando Storage', error);
      this._storage = null; 
    }
  }

  async loadToken() {
    if (!this._storage) {
      console.error('[AuthService - loadToken] _storage es null. No se puede obtener token.');
      this.setUnauthenticatedState();
      return;
    }
    try {
      const token = await this._storage.get(TOKEN_KEY);
      console.log('[AuthService - loadToken] Token obtenido de storage:', token);
      if (token) {
        this.processToken(token);
      } else {
        this.setUnauthenticatedState();
        console.log('[AuthService - loadToken] No se encontró token en storage. Estado no autenticado.');
      }
    } catch (error) {
      console.error('[AuthService - loadToken] Excepción al intentar obtener token de Storage', error);
      this.setUnauthenticatedState();
    }
  }

  private processToken(token: string) {
    this.currentToken.next(token);
    const decodedPayload = this.decodeTokenPayload(token);
    console.log('[AuthService - processToken] Payload decodificado:', decodedPayload);

    if (decodedPayload) {
      const roleEnum = this.parseRoleFromToken(decodedPayload);
      const userEmail = decodedPayload.sub;
      const userName = decodedPayload.name || userEmail; 
      const userId = decodedPayload.userId || decodedPayload.id || decodedPayload.sub;

      this.currentUserRole.next(roleEnum);
      const userFromToken: User = {
        id: userId as string, 
        email: userEmail || 'N/A',
        role: roleEnum || Rol.ESTUDIANTE, 
        name: userName || 'Usuario',
        avatarUrl: decodedPayload.avatarUrl || decodedPayload.picture || undefined,
      };
      this.currentUser.next(userFromToken);
      this.isAuthenticated.next(true);
      console.log('[AuthService - processToken] Estado de autenticación actualizado:', {
        isAuthenticated: true,
        user: userFromToken
      });
    } else {
      console.error('[AuthService - processToken] Falló la decodificación del token o payload inválido.');
      this.clearAuthDataAndSetUnauthenticated();
    }
  }

  private decodeTokenPayload(token: string): any | null {
    try {
      const payloadBase64Url = token.split('.')[1];
      if (!payloadBase64Url) return null;
      const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
      const decodedJson = decodeURIComponent(atob(payloadBase64).split('').map((c: string) =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
      return JSON.parse(decodedJson);
    } catch (e) {
      console.error('[AuthService - decodeTokenPayload] Error al decodificar:', e);
      return null;
    }
  }

  private parseRoleFromToken(decodedPayload: any): Rol | null {
    let roleString: string | undefined;
    if (decodedPayload.authorities && Array.isArray(decodedPayload.authorities) && decodedPayload.authorities.length > 0) {
      roleString = decodedPayload.authorities[0].toUpperCase().replace('ROLE_', '');
    } else if (decodedPayload.role && typeof decodedPayload.role === 'string') { 
      roleString = decodedPayload.role.toUpperCase().replace('ROLE_', '');
    }

    if (roleString && (Object.values(Rol) as string[]).includes(roleString)) {
      return Rol[roleString as keyof typeof Rol];
    }
    console.warn('[AuthService - parseRoleFromToken] No se pudo parsear un rol válido, usando ESTUDIANTE por defecto. Payload:', decodedPayload);
    return Rol.ESTUDIANTE; 
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(
      tap(async (res) => {
        if (res && res.token && this._storage) {
          await this._storage.set(TOKEN_KEY, res.token);
          this.processToken(res.token);
        }
      }),
      catchError(this.handleAuthError)
    );
  }

  login(credentials: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/authenticate`, credentials).pipe(
      tap(async (res) => {
        if (res && res.token && this._storage) {
          await this._storage.set(TOKEN_KEY, res.token);
          this.processToken(res.token); 
        } else {
          this.setUnauthenticatedState();
        }
      }),
      catchError(this.handleAuthError)
    );
  }

  async logout() {
    console.log('[AuthService - logout] Iniciando logout...');
    try {
      await this.clearAuthDataAndSetUnauthenticated();
      setTimeout(() => {
        this.navCtrl.navigateRoot('/login', { animated: true, animationDirection: 'back' });
        console.log('[AuthService - logout] Redirección a /login ejecutada.');
      }, 50); 
    } catch (error) {
      console.error('[AuthService - logout] Error durante el proceso de logout:', error);
      this.setUnauthenticatedState(); 
      setTimeout(() => { 
         this.navCtrl.navigateRoot('/login', { animated: true, animationDirection: 'back' });
      }, 50);
    }
  }

  private async clearAuthDataAndSetUnauthenticated() {
    console.log('[AuthService - clearAuthDataAndSetUnauthenticated] Limpiando datos de autenticación...');
    if (!this._storage) {
      console.warn('[AuthService - clearAuthDataAndSetUnauthenticated] Storage no inicializado, intentando de nuevo.');
      await this.initStorage();
      if (!this._storage) {
          console.error('[AuthService - clearAuthDataAndSetUnauthenticated] Storage SIGUE sin inicializar. No se puede remover token.');
          this.setUnauthenticatedState(); 
          return;
      }
    }
    try {
      const tokenBefore = await this._storage.get(TOKEN_KEY);
      console.log(`[AuthService] Token antes de remover de storage: ${tokenBefore}`);
      await this._storage.remove(TOKEN_KEY);
      const tokenAfter = await this._storage.get(TOKEN_KEY);
      console.log(`[AuthService] Token después de remover de storage: ${tokenAfter}`);
    } catch (storageError) {
        console.error('[AuthService - clearAuthDataAndSetUnauthenticated] Error al interactuar con storage:', storageError);
    }
    this.setUnauthenticatedState();
  }

  private setUnauthenticatedState() {
    console.log('[AuthService - setUnauthenticatedState] Actualizando BehaviorSubjects a estado no autenticado.');
    this.isAuthenticated.next(false);
    this.currentUserRole.next(null);
    this.currentUser.next(null);
    this.currentToken.next(null);
  }

  public updateCurrentUser(updatedUserData: Partial<User>) {
    const current = this.currentUser.value;
    if (current) {
        const newUser = { ...current, ...updatedUserData };
        this.currentUser.next(newUser);
        console.log('[AuthService - updateCurrentUser] currentUser actualizado:', this.currentUser.value);
    }
  }

  getIsAuthenticated(): Observable<boolean | null> { return this.isAuthenticated.asObservable(); }
  getCurrentUserRole(): Observable<Rol | null> { return this.currentUserRole.asObservable(); }
  getCurrentUser(): Observable<User | null> { return this.currentUser.asObservable(); }
  
  async getToken(): Promise<string | null> {
    if (!this._storage) {
        await this.initStorage();
        if (!this._storage) return null;
    }
    return this._storage.get(TOKEN_KEY);
  }

  private handleAuthError = (error: HttpErrorResponse): Observable<never> => {
    console.error('[AuthService - handleAuthError] API Error:', error);
    let userMessage = 'Error de autenticación o conexión con el servidor.';
    if (error.status === 0) { 
        userMessage = 'No se pudo conectar con el servidor. Verifica tu conexión o que el servidor esté activo.';
    } else if (error.status === 401) { 
        userMessage = 'Credenciales incorrectas. Por favor, verifica tu correo y contraseña.';
    } else if (error.status === 403) {
        userMessage = 'No tienes permiso para acceder a este recurso.';
    } else if (error.error && typeof error.error.message === 'string') { 
        userMessage = error.error.message;
    } else if (typeof error.message === 'string' && error.status !== 0) {
        userMessage = error.message;
    }
    
    if (error.status === 401 ) {
        console.warn('[AuthService - handleAuthError] Error 401 detectado, intentando logout...');
        this.logout(); 
    }
    return throwError(() => new Error(userMessage));
  }
}