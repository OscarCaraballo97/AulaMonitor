
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { IonicModule, MenuController, Platform, PopoverController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { Rol } from '../models/rol.model';
import { User } from '../models/user.model';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
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
  ],
})
export class MainLayoutPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  appName = 'IMonitoring';
  userRole: Rol | null = null;
  currentUser: User | null = null; 

  isUserDropdownOpen = false;
  isSettingsPanelOpen = false;
  isNotificationsPanelOpen = false;
  isSearchPanelOpen = false;
  showPageLoading = false; 

  navLinks: NavLink[] = [
    { title: 'Dashboard', icon: 'home-outline', route: '/app/dashboard', roles: [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE] },
    { title: 'Edificios', icon: 'business-outline', route: '/app/buildings', roles: [Rol.ADMIN, Rol.PROFESOR] },
    { title: 'Aulas', icon: 'cube-outline', route: '/app/classrooms', roles: [Rol.ADMIN, Rol.PROFESOR] },
    { title: 'Reservas', icon: 'calendar-outline', route: '/app/reservations', roles: [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR] },
    { title: 'Usuarios', icon: 'people-outline', route: '/app/users', roles: [Rol.ADMIN] },
  ];
  filteredNavLinks: NavLink[] = [];

  constructor(
    public authService: AuthService,
    public themeService: ThemeService,
    private menuCtrl: MenuController,
    private router: Router,
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


    this.currentUser = {
      email: 'admin@example.com',
      role: Rol.ADMIN,
      name: 'Admin Principal',
      avatarUrl: 'https://avatars.githubusercontent.com/u/57622665?s=460&u=8f581f4c4acd4c18c33a87b3e6476112325e8b38&v=4' // URL de ejemplo
    };

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updateLinkActiveStates();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateFilteredNavLinks() {
    if (!this.userRole) {
      this.filteredNavLinks = []; return;
    }
    this.filteredNavLinks = this.navLinks.filter(link =>
      link.roles ? link.roles.includes(this.userRole!) : true
    ).map(link => ({
      ...link,
      children: link.children?.filter(child =>
        child.roles ? child.roles.includes(this.userRole!) : true
      )
    }));
    this.updateLinkActiveStates();
  }

  updateLinkActiveStates() {
    this.filteredNavLinks = this.filteredNavLinks.map(link => {
      let isActive = false;
      if (link.route) {
        isActive = this.router.isActive(link.route, { paths: 'exact', queryParams: 'subset', fragment: 'ignored', matrixParams: 'ignored' });
      }
      if (link.children && !isActive) {
        isActive = link.children.some(child => child.route ? this.router.isActive(child.route, { paths: 'exact', queryParams: 'subset', fragment: 'ignored', matrixParams: 'ignored' }) : false);
      }

      return { ...link, isActive };
    });
  }

  isLinkActive(link?: NavLink): boolean {
    if (!link) return false;

    return !!link.isActive;
  }

  toggleAccordion(item: NavLink, event?: MouseEvent) {
    event?.preventDefault();
    item.open = !item.open;
  }

  async closeMenu() {
    if (this.platform.is('mobile') || this.platform.width() < 768) {
      await this.menuCtrl.close('kwd-sidebar');
    }
  }

  openPanel(panelName: 'settings' | 'notifications' | 'search') {
    if (panelName === 'settings') this.isSettingsPanelOpen = true;
    else if (panelName === 'notifications') this.isNotificationsPanelOpen = true;
    else if (panelName === 'search') this.isSearchPanelOpen = true;
  }

  closePanel(panelName: 'settings' | 'notifications' | 'search') {
    if (panelName === 'settings') this.isSettingsPanelOpen = false;
    else if (panelName === 'notifications') this.isNotificationsPanelOpen = false;
    else if (panelName === 'search') this.isSearchPanelOpen = false;
  }

  async openMobileSubMenu(ev: any) {
    const popover = await this.popoverCtrl.create({
      component: MobileActionsPopoverComponent,
      event: ev,
      translucent: true,
      dismissOnSelect: true,
      cssClass: 'kwd-mobile-actions-popover'
    });
    await popover.present();

    const { data } = await popover.onDidDismiss();
    if (data && data.action) {
      switch (data.action) {
        case 'notifications': this.openPanel('notifications'); break;
        case 'search': this.openPanel('search'); break;
        case 'settings': this.openPanel('settings'); break;
        case 'theme': this.themeService.toggleTheme(); break;
      }
    }
  }
  
}