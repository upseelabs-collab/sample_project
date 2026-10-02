import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { InstagramService } from '../../services/instagram.service';
import { SafeInstagramConnection } from '../../models/instagram.model';

@Component({
  selector: 'app-instagram-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './instagram-callback.component.html',
  styleUrls: ['./instagram-callback.component.css'],
})
export class InstagramCallbackComponent implements OnInit {
  isSuccess = false;
  isProcessing = true;
  errorMessage = '';
  connectionData: SafeInstagramConnection | null = null;
  countdown = 2;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private instagramService: InstagramService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const successParam = params['success'];
      const errorParam = params['error'];

      if (successParam === 'true') {
        this.isSuccess = true;
        this.isProcessing = true;
        
        // Fetch safe connection details to confirm registration
        this.instagramService.getConnection().subscribe({
          next: (res) => {
            this.isProcessing = false;
            this.connectionData = res.data;
            this.startRedirectCountdown();
          },
          error: () => {
            this.isProcessing = false;
            this.startRedirectCountdown();
          },
        });
      } else {
        this.isSuccess = false;
        this.isProcessing = false;
        this.errorMessage = errorParam || 'Instagram authorization was cancelled or failed.';
      }
    });
  }

  private startRedirectCountdown(): void {
    const timer = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(timer);
        this.router.navigate(['/instagram']);
      }
    }, 1000);
  }

  goToDashboard(): void {
    this.router.navigate(['/instagram']);
  }
}
