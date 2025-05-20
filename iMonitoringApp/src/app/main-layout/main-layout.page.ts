import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule, NavigationEnd, IsActiveMatchOptions, ActivatedRoute, Routes } from '@angular/router';
import { IonicModule, Platform, PopoverController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { Rol } from '../models/rol.model';
import { User } from '../models/user.model';
import { Subject } from 'rxjs';
import { filter, takeUntil, map, take } from 'rxjs/operators'; 
import { SettingsPanelComponent } from '../components/settings-panel/settings-panel.component';
import { MobileActionsPopoverComponent } from '../components/mobile-actions-popover/mobile-actions-popover.component';

interface NavLink {
  title: string;
  icon?: string;
  svgPath?: string;
  route?: string;
  children?: NavLink[];
  open?: boolean;
  roles?: Rol[];
  isActive?: boolean;
}

@Component({
  selector: 'app-main-layout',
  templateUrl: './main-layout.page.html',
  styleUrls: ['./main-layout.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    RouterModule,
    SettingsPanelComponent,
    MobileActionsPopoverComponent,
  ],
})
export class MainLayoutPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  appName = 'AulaMonitor'; 
  userRole: Rol | null = null;
  currentUser: User | null = null;
  currentPageTitle: string = 'AulaMonitor';

  isUserDropdownOpen = false; 
  isSettingsPanelOpen = false;
  isNotificationsPanelOpen = false;
  isSearchPanelOpen = false;
  showPageLoading = false; 

  navLinks: NavLink[] = [
    { title: 'Dashboard', icon: 'home-outline', route: '/app/dashboard', roles: [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE] },
    { title: 'Edificios', icon: 'business-outline', route: '/app/buildings', roles: [Rol.ADMIN] },
    { title: 'Aulas', icon: 'cube-outline', route: '/app/classrooms', roles: [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE] },
    { title: 'Reservas', icon: 'calendar-outline', route: '/app/reservations', roles: [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE] },
    { title: 'Usuarios', icon: 'people-outline', route: '/app/users', roles: [Rol.ADMIN] },
  ];
  filteredNavLinks: NavLink[] = [];

  private activeElementBeforeOverlay: HTMLElement | null = null;

  constructor(
    public authService: AuthService,
    public themeService: ThemeService,
    private router: Router,
    private activatedRoute: ActivatedRoute, 
    private popoverCtrl: PopoverController,
    private platform: Platform, 
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.authService.getCurrentUserRole().pipe(takeUntil(this.destroy$)).subscribe((role: Rol | null) => {
      this.userRole = role;
      this.updateFilteredNavLinks();
    });

    this.authService.getCurrentUser().pipe(
      takeUntil(this.destroy$)
    ).subscribe((user: User | null) => {
      this.currentUser = user;
      console.log('MainLayoutPage: currentUser actualizado por AuthService ->', this.currentUser);
      this.cdr.detectChanges();
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => { 
      this.updateLinkActiveStates();
      this.updatePageTitle(event.urlAfterRedirects); 
    });
    this.updatePageTitle(this.router.url); 
  }

  
  private storeActiveElement() {
    if (document.activeElement && document.activeElement !== document.body) {
      this.activeElementBeforeOverlay = document.activeElement as HTMLElement;
    } else {
      this.activeElementBeforeOverlay = null;
    }
  }

  private blurActiveElement() {
    if (document.activeElement && typeof (document.activeElement as HTMLElement).blur === 'function' && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
  }

  private restoreActiveElement() {
    if (this.activeElementBeforeOverlay && typeof this.activeElementBeforeOverlay.focus === 'function') {
      setTimeout(() => {
        this.activeElementBeforeOverlay?.focus();
        this.activeElementBeforeOverlay = null;
      }, 150);
    }
  }

  updatePageTitle(currentUrl: string) {
    let route = this.activatedRoute;
    while (route.firstChild) {
      route = route.firstChild;
    }
    
    route.data.pipe(take(1)).subscribe((data: any) => {
      const routeConfigTitle = this.findTitleInRouteConfigForUrl(currentUrl, this.router.config.find(r => r.path === 'app')?.children || []);
      this.currentPageTitle = routeConfigTitle || data['title'] || this.getAppNameBasedOnRoute() || 'AulaMonitor';
      this.cdr.detectChanges();
    });
  }
  
  private findTitleInRouteConfigForUrl(url: string, routes: Routes, basePath: string = '/app'): string | undefined {
    for (const route of routes) {
      const routePath = route.path ? (basePath + '/' + route.path).replace('//', '/') : basePath;
      const isActive = this.router.isActive(routePath, {paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored'});

      if (isActive && route.data && route.data['title']) {
        return route.data['title'];
      }
      
      if (route.children) {
        const titleFromChild = this.findTitleInRouteConfigForUrl(url, route.children, routePath);
        if (titleFromChild) {
          return titleFromChild;
        }
      }
    }
    return undefined;
  }

  getAppNameBasedOnRoute(): string {
    const currentUrl = this.router.url.toLowerCase();
    if (currentUrl.includes('dashboard')) return 'Dashboard';
    if (currentUrl.includes('reservations')) return 'Mis Reservas';
    if (currentUrl.includes('classrooms')) return 'Aulas';
    if (currentUrl.includes('buildings')) return 'Edificios';
    if (currentUrl.includes('users')) return 'Usuarios';
    if (currentUrl.includes('profile')) return 'Mi Perfil';
    return this.appName;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateFilteredNavLinks() {
    if (!this.userRole) {
      this.filteredNavLinks = [];
      this.cdr.detectChanges();
      return;
    }
    this.filteredNavLinks = this.navLinks.filter(link =>
      link.roles ? link.roles.includes(this.userRole!) : true
    ).map(link => ({ ...link })); 
    this.updateLinkActiveStates();
  }

  updateLinkActiveStates() {
    const defaultMatchOptions: IsActiveMatchOptions = {
        paths: 'exact', queryParams: 'subset', fragment: 'ignored', matrixParams: 'ignored'
    };
   
    this.filteredNavLinks = this.filteredNavLinks.map(link => {
      let localIsActive = false; 
      if (link.route) {
        localIsActive = this.router.isActive(link.route, { ...defaultMatchOptions, paths: 'subset' });
      }
      return { ...link, isActive: localIsActive };
    });
    this.cdr.detectChanges();
  }
  
  isLinkActive(link?: NavLink): boolean {
    if (!link) return false;
    return !!link.isActive; 
  }

  openPanel(panelName: 'settings' | 'notifications' | 'search') {
    this.storeActiveElement(); 
    this.blurActiveElement();   

    if (panelName === 'settings') this.isSettingsPanelOpen = true;
    else if (panelName === 'notifications') this.isNotificationsPanelOpen = true;
    else if (panelName === 'search') this.isSearchPanelOpen = true;
    this.cdr.detectChanges();
  }

  closePanel(panelName: 'settings' | 'notifications' | 'search') {
    if (panelName === 'settings') this.isSettingsPanelOpen = false;
    else if (panelName === 'notifications') this.isNotificationsPanelOpen = false;
    else if (panelName === 'search') this.isSearchPanelOpen = false;
    this.cdr.detectChanges();
    this.restoreActiveElement(); 
  }

  async openMobileSubMenu(ev: any) {
    this.storeActiveElement();
    const popover = await this.popoverCtrl.create({
      component: MobileActionsPopoverComponent,
      event: ev,
      translucent: true,
      dismissOnSelect: true,
      cssClass: 'kwd-mobile-actions-popover'
    });
    
    popover.onDidDismiss().then((detail) => { 
      this.restoreActiveElement();
      if (detail && detail.data && detail.data.action) {
        this.handlePopoverAction(detail.data.action);
      }
    });
    await popover.present();
  }

  handlePopoverAction(action: string) {
    console.log('MainLayoutPage - Handling popover action:', action); 
    switch (action) {
      case 'notifications': this.openPanel('notifications'); break;
      case 'search': this.openPanel('search'); break;
      case 'settings': this.openPanel('settings'); break;
      case 'profile': this.navigateToProfile(); break; 
      case 'logout': this.logout(); break; 
    }
  }
  
  handleAvatarError(event: Event) {
    const element = event.target as HTMLImageElement;
    if (element) {
      element.src = 'assets/icon/default-avatar.svg';
    }
  }

  navigateToProfile() {
    this.navCtrl.navigateForward('/app/profile');
  }

  triggerDesktopLogout() {
    console.log('MainLayoutPage - triggerDesktopLogout() calling authService.logout()');
    this.authService.logout();
  }

  logout() {
    console.log('MainLayoutPage - logout() method calling authService.logout()');
    this.authService.logout();
  }
}