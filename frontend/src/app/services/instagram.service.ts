import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  SafeInstagramConnection,
  InstagramProfile,
  InstagramMediaItem,
  ConnectionStatusResponse,
} from '../models/instagram.model';

@Injectable({
  providedIn: 'root',
})
export class InstagramService {
  private readonly baseUrl = `${environment.apiUrl}/instagram`;

  constructor(private http: HttpClient) {}

  /**
   * Retrieves the current user's safe connection metadata.
   */
  getConnection(): Observable<ConnectionStatusResponse> {
    return this.http.get<ConnectionStatusResponse>(`${this.baseUrl}/connection`);
  }

  /**
   * Initiates Instagram OAuth flow by redirecting the browser directly to backend OAuth.
   * Does NOT require or expose access tokens or secrets.
   */
  connectInstagram(): void {
    window.location.href = `${this.baseUrl}/auth?redirect=true`;
  }

  /**
   * Fetches fresh Instagram profile details from Meta Graph API.
   */
  getProfile(): Observable<ApiResponse<InstagramProfile>> {
    return this.http.get<ApiResponse<InstagramProfile>>(`${this.baseUrl}/profile`);
  }

  /**
   * Fetches Instagram media items (images, reels, carousels).
   */
  getMedia(limit: number = 12, after?: string): Observable<ApiResponse<InstagramMediaItem[]> & { paging?: any }> {
    let params = new HttpParams().set('limit', limit.toString());
    if (after) {
      params = params.set('after', after);
    }
    return this.http.get<ApiResponse<InstagramMediaItem[]> & { paging?: any }>(
      `${this.baseUrl}/media`,
      { params }
    );
  }

  /**
   * Disconnects the Instagram account and clears server-side encrypted credentials.
   */
  disconnectInstagram(): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/connection`);
  }

  /**
   * Diagnostic token verification endpoint for development.
   */
  testToken(): Observable<ApiResponse<InstagramProfile>> {
    return this.http.get<ApiResponse<InstagramProfile>>(`${this.baseUrl}/test`);
  }
}
