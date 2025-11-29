import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';

export async function POST(request: NextRequest) {
  try {
    const { url, token, path, method = 'GET', params, data } = await request.json();

    if (!url || !token || !path) {
      return NextResponse.json(
        { error: 'URL, token, and path are required' },
        { status: 400 }
      );
    }

    // Properly combine URL and path, avoiding double slashes
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${baseUrl}${cleanPath}`;
    
    console.log('🔗 URL combination:', { url, path, baseUrl, cleanPath, fullUrl });
    
    const config = {
      method,
      url: fullUrl,
      headers: {
        'X-Plex-Token': token,
        'Accept': 'application/json',
        'X-Plex-Client-Identifier': 'plex-holiday-playlist-maker',
        'X-Plex-Product': 'Plex Holiday Playlist Maker',
        'X-Plex-Version': '1.0.0',
      },
      timeout: 300000, // 5 minutes - increased for large library scans
      params,
      data,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Allow self-signed certificates
      }),
    };

    console.log('🔄 Plex API Request:', {
      method: config.method,
      url: config.url,
      params: config.params,
      data: config.data,
      headers: { ...config.headers, 'X-Plex-Token': '[REDACTED]' }
    });

    // Build the full URL with query params for logging
    const urlWithParams = new URL(config.url);
    if (config.params) {
      Object.entries(config.params).forEach(([key, value]) => {
        urlWithParams.searchParams.append(key, String(value));
      });
    }
    console.log('🌐 Full URL with params:', urlWithParams.toString());

    const response = await axios(config);
    console.log('✅ Plex API Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    });
    
    // For PUT requests to playlist items, log additional details
    if (method === 'PUT' && path.includes('/playlists/') && path.includes('/items')) {
      console.log('🎵 Playlist Update Details:', {
        playlistPath: path,
        requestParams: params,
        responseSize: response.data ? JSON.stringify(response.data).length : 0,
        success: response.status >= 200 && response.status < 300
      });
    }
    
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('❌ Plex proxy request failed:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const responseData = error.response?.data;
      const message = responseData?.message || error.message;
      
      console.error('📋 Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: responseData,
        headers: error.response?.headers,
        config: {
          method: error.config?.method,
          url: error.config?.url,
          params: error.config?.params,
          data: error.config?.data
        },
        // Log the full URL that was attempted
        attemptedUrl: error.config?.url ? 
          `${error.config.url}${error.config.params ? '?' + new URLSearchParams(error.config.params as Record<string, string>).toString() : ''}` 
          : 'unknown'
      });
      
      return NextResponse.json(
        { error: message, details: responseData },
        { status }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}