import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { InstagramService } from '../../services/instagram.service';
import {
  SafeInstagramConnection,
  InstagramProfile,
  InstagramMediaItem,
} from '../../models/instagram.model';

type ViewState = 'loading' | 'not_connected' | 'connected' | 'error';

@Component({
  selector: 'app-instagram-connect',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './instagram-connect.component.html',
  styleUrls: ['./instagram-connect.component.css'],
})
export class InstagramConnectComponent implements OnInit {
  state: ViewState = 'loading';
  isRedirecting = false;
  connection: SafeInstagramConnection | null = null;
  profile: InstagramProfile | null = null;
  mediaItems: InstagramMediaItem[] = [];
  
  isLoadingMedia = false;
  mediaLoaded = false;
  mediaPagingNext?: string;
  errorMessage = '';
  
  showDisconnectModal = false;
  isDisconnecting = false;

  constructor(private instagramService: InstagramService) {}

  ngOnInit(): void {
    this.fetchConnectionStatus();
  }

  /**
   * Checks whether the current user has an active connected Instagram account.
   */
  fetchConnectionStatus(): void {
    this.state = 'loading';
    this.instagramService.getConnection().subscribe({
      next: (res) => {
        if (res.connected && res.data) {
          this.connection = res.data;
          this.state = 'connected';
          this.fetchLiveProfile();
          this.loadMedia();
        } else {
          this.connection = null;
          this.state = 'not_connected';
        }
      },
      error: (err) => {
        console.error('Failed to get Instagram connection status:', err);
        this.state = 'not_connected';
      },
    });
  }

  /**
   * Fetches fresh Instagram profile metadata.
   */
  fetchLiveProfile(): void {
    this.instagramService.getProfile().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.profile = res.data;
        }
      },
      error: (err) => {
        console.warn('Profile fetch notice:', err?.error?.error || err.message);
      },
    });
  }

  /**
   * Initiates the consumer OAuth registration flow.
   * Redirects user directly to Meta authorization dialog.
   */
  connect(): void {
    if (this.isRedirecting) return;
    this.isRedirecting = true;
    this.state = 'loading';
    this.instagramService.connectInstagram();
  }

  /**
   * Loads recent media items for the connected account.
   */
  loadMedia(): void {
    this.isLoadingMedia = true;
    this.instagramService.getMedia(12).subscribe({
      next: (res) => {
        this.isLoadingMedia = false;
        this.mediaLoaded = true;
        this.mediaItems = res.data || [];
        this.mediaPagingNext = res.paging?.cursors?.after;
      },
      error: (err) => {
        this.isLoadingMedia = false;
        console.error('Error loading media posts:', err);
      },
    });
  }

  /**
   * Loads more media items with pagination cursor.
   */
  loadMoreMedia(): void {
    if (!this.mediaPagingNext || this.isLoadingMedia) return;
    this.isLoadingMedia = true;
    this.instagramService.getMedia(12, this.mediaPagingNext).subscribe({
      next: (res) => {
        this.isLoadingMedia = false;
        if (res.data && res.data.length > 0) {
          this.mediaItems = [...this.mediaItems, ...res.data];
          this.mediaPagingNext = res.paging?.cursors?.after;
        } else {
          this.mediaPagingNext = undefined;
        }
      },
      error: (err) => {
        this.isLoadingMedia = false;
        console.error('Error loading more media:', err);
      },
    });
  }

  /**
   * Opens the confirmation modal for disconnection.
   */
  openDisconnectModal(): void {
    this.showDisconnectModal = true;
  }

  /**
   * Disconnects the Instagram account and cleans up stored credentials.
   */
  confirmDisconnect(): void {
    this.isDisconnecting = true;
    this.instagramService.disconnectInstagram().subscribe({
      next: () => {
        this.isDisconnecting = false;
        this.showDisconnectModal = false;
        this.connection = null;
        this.profile = null;
        this.mediaItems = [];
        this.mediaLoaded = false;
        this.state = 'not_connected';
      },
      error: (err) => {
        this.isDisconnecting = false;
        this.showDisconnectModal = false;
        console.error('Failed to disconnect Instagram:', err);
      },
    });
  }
}
