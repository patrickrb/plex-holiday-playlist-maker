import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';

export async function POST(request: NextRequest) {
  try {
    const { url, token } = await request.json();

    if (!url || !token) {
      return NextResponse.json(
        { error: 'URL and token are required' },
        { status: 400 }
      );
    }

    // Test connection to Plex server
    const response = await axios.get(`${url}/identity`, {
      headers: {
        'X-Plex-Token': token,
        'Accept': 'application/json',
      },
      timeout: 10000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Allow self-signed certificates
      }),
    });

    if (response.status === 200) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Invalid response from Plex server' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Plex connection test failed:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { error: 'Could not connect to Plex server. Check the URL and ensure Plex is running.' },
          { status: 400 }
        );
      } else if (error.response?.status === 401) {
        return NextResponse.json(
          { error: 'Invalid Plex token. Please check your authentication token.' },
          { status: 401 }
        );
      } else if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
        return NextResponse.json(
          { error: 'SSL certificate error. Try using HTTP instead of HTTPS, or use the local network address.' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to connect to Plex server' },
      { status: 500 }
    );
  }
}