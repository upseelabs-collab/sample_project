import { Routes } from '@angular/router';
import { InstagramConnectComponent } from './components/instagram-connect/instagram-connect.component';
import { InstagramCallbackComponent } from './components/instagram-callback/instagram-callback.component';

export const routes: Routes = [
  { path: '', component: InstagramConnectComponent },
  { path: 'instagram', component: InstagramConnectComponent },
  { path: 'instagram/callback', component: InstagramCallbackComponent },
  { path: '**', redirectTo: '' },
];
