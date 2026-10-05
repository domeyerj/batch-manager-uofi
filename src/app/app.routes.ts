import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'tasks', pathMatch: 'full' },
  {
    path: 'tasks',
    loadComponent: () =>
      import('./features/tasks-monitor/tasks-monitor.component').then(
        (m) => m.TasksMonitorComponent
      ),
  },
  {
    path: 'launch',
    loadComponent: () =>
      import('./features/task-launcher/task-launcher.component').then(
        (m) => m.TaskLauncherComponent
      ),
  },
  {
    path: 'schedules',
    loadComponent: () =>
      import('./features/schedules/schedules.component').then(
        (m) => m.SchedulesComponent
      ),
  },
  {
    path: 'infrastructure',
    loadComponent: () =>
      import('./features/infrastructure/infrastructure.component').then(
        (m) => m.InfrastructureComponent
      ),
  },
];
