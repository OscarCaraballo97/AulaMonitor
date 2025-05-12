
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
    try {
      this._storage = await this.storage.create();
      console.log('AuthService: Storage inicializado.');
    } catch (error) {
      console.error('AuthService: Error inicializando Storage', error);
    }
  }

  async loadToken() {
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
      const userEmail = decodedPayload.sub; 

      console.log('[AuthService - processToken] Rol parseado:', role, '| Email (sub):', userEmail);

      this.currentUserRole.next(role);
      const userFromToken: User = {
        email: userEmail || 'Error al decodificar email',
        role: role || Rol.ESTUDIANTE, 
        id: decodedPayload.jti || decodedPayload.id || undefined, 
        name: decodedPayload.name || decodedPayload.firstName || userEmail, 
        avatarUrl: decodedPayload.picture || decodedPayload.avatarUrl || undefined,
      };
      this.currentUser.next(userFromToken);
      this.isAuthenticated.next(true);
      console.log('[AuthService - processToken] Estado actualizado: isAuthenticated=true. currentUserRole y currentUser emitidos.');
    } else {
      console.error('[AuthService - processToken] FALLÓ LA DECODIFICACIÓN DEL TOKEN o payload inválido.');
      this.clearAuthDataAndSetUnauthenticated();
    }
  }

  private decodeTokenPayload(token: string): any | null {
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
    console.log("[AuthService - parseRoleFromToken] Intentando parsear rol desde payload:", decodedPayload);

    let roleString: string | undefined;


    if (decodedPayload.authorities && Array.isArray(decodedPayload.authorities) && decodedPayload.authorities.length > 0) {
      roleString = decodedPayload.authorities[0].toUpperCase().replace('ROLE_', '');
      console.log("[AuthService - parseRoleFromToken] Rol encontrado en claim 'authorities[0]':", roleString);
    }

    else if (decodedPayload.role && typeof decodedPayload.role === 'string') {
      roleString = decodedPayload.role.toUpperCase();
      console.log("[AuthService - parseRoleFromToken] Rol encontrado en claim 'role':", roleString);
    }
 
    if (roleString && (roleString in Rol)) {

      const parsed = Rol[roleString as keyof typeof Rol];
      console.log("[AuthService - parseRoleFromToken] Rol parseado exitosamente a enum:", parsed);
      return parsed;
    }

    console.warn('[AuthService - parseRoleFromToken] No se pudo parsear un rol válido desde el token. Claim de rol no encontrado o valor no válido. Payload:', decodedPayload);
    return null; 
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
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
    console.log('[AuthService - login] Iniciando sesión con credenciales:', credentials);
    return this.http.post<AuthResponse>(`${this.apiUrl}/authenticate`, credentials).pipe(
      tap(async (res) => {
        console.log('[AuthService - login] Respuesta de autenticación backend:', res);
        if (res && res.token && this._storage) {
          await this._storage.set(TOKEN_KEY, res.token);
          this.processToken(res.token);
        } else {
          console.warn('[AuthService - login] Respuesta de login no contiene token.');
        
          this.setUnauthenticatedState();
        }
      }),
      catchError(this.handleAuthError) 
    );
  }

  async logout() {
    console.log('[AuthService - logout] Ejecutando logout.');
    await this.clearAuthDataAndSetUnauthenticated();
    this.navCtrl.navigateRoot('/login', { animated: true, animationDirection: 'back' });
  }

  private async clearAuthDataAndSetUnauthenticated() {
    if (!this._storage) await this.initStorage();
    await this._storage?.remove(TOKEN_KEY);
    this.setUnauthenticatedState();
    console.log('[AuthService - clearAuthDataAndSetUnauthenticated] Datos de autenticación limpiados.');
  }

  private setUnauthenticatedState() {
    this.isAuthenticated.next(false);
    this.currentUserRole.next(null);
    this.currentUser.next(null);
    this.currentToken.next(null);
  }

  getIsAuthenticated(): Observable<boolean | null> { return this.isAuthenticated.asObservable(); }
  getCurrentUserRole(): Observable<Rol | null> { return this.currentUserRole.asObservable(); }
  getCurrentUser(): Observable<User | null> { return this.currentUser.asObservable(); }
  async getToken(): Promise<string | null> {
    if (!this._storage) await this.initStorage();
    return this._storage ? this._storage.get(TOKEN_KEY) : null;
  }

  private handleAuthError = (error: any): Observable<never> => {
    console.error('[AuthService - handleAuthError] API Error:', error);
    const message = error.error?.message || error.message || 'Error de autenticación o conexión con el servidor.';
    
    return throwError(() => new Error(message));
  }
}