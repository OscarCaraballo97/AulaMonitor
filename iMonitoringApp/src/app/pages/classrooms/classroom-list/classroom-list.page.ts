import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-classroom-list',
  templateUrl: './classroom-list.page.html',
  styleUrls: ['./classroom-list.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class ClassroomListPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
