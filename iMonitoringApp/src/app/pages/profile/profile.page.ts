import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { Rol } from '../../models/rol.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class ProfilePage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  currentUser: User | null = null;
  userRole: Rol | null = null;
  isLoading = true;

  public RolEnum = Rol; 

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private navCtrl: NavController 
  ) { }

  ngOnInit() {
    console.log("ProfilePage: ngOnInit");
    this.authService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        console.log("ProfilePage: currentUser ->", this.currentUser);
        this.isLoading = false;
        this.cdr.detectChanges();
      });

    this.authService.getCurrentUserRole()
      .pipe(takeUntil(this.destroy$))
      .subscribe(role => {
        this.userRole = role;
        console.log("ProfilePage: userRole ->", this.userRole);
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }


  editProfile() {
 
    console.log("Editar perfil no implementado aún.");
  }

  goBack() {
    this.navCtrl.back();
  }
}
