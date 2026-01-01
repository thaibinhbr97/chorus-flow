import { generateACRCloudSignature } from '@/utils/acrcloud';
import { NextRequest, NextResponse } from 'next/server';

const ACRCLOUD_HOST = process.env.ACRCLOUD_HOST || 'identify-us-west-2.acrcloud.com';
const ACRCLOUD_ACCESS_KEY = process.env.ACRCLOUD_ACCESS_KEY || '';
const ACRCLOUD_ACCESS_SECRET = process.env.ACRCLOUD_ACCESS_SECRET || '';
const LRCLIB_API_URL = process.env.LRCLIB_API_URL || 'https://lrclib.net/api';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('sample') as Blob;

        if (!file) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        // 1. Identify with ACRCloud
        const timestamp = Math.floor(Date.now() / 1000).toString();

        console.log('--- Debugging Signature ---');
        console.log('Access Key:', ACRCLOUD_ACCESS_KEY ? 'Set' : 'Missing');
        console.log('Access Secret:', ACRCLOUD_ACCESS_SECRET ? 'Set' : 'Missing');
        console.log('Timestamp:', timestamp);
        console.log('URI:', '/v1/identify');
        console.log('Method:', 'POST');

        const signature = generateACRCloudSignature(
            'POST',
            '/v1/identify',
            ACRCLOUD_ACCESS_KEY,
            ACRCLOUD_ACCESS_SECRET,
            'audio',
            '1',
            timestamp
        );
        console.log('Generated Signature:', signature);

        const acrFormData = new FormData();
        acrFormData.append('sample', file);
        acrFormData.append('access_key', ACRCLOUD_ACCESS_KEY);
        acrFormData.append('data_type', 'audio');
        acrFormData.append('audio_type', 'recorded'); // Optimized for noisy environments
        acrFormData.append('signature_version', '1');
        acrFormData.append('signature', signature);
        acrFormData.append('timestamp', timestamp);
        acrFormData.append('sample_bytes', file.size.toString());

        const acrResponse = await fetch(`https://${ACRCLOUD_HOST}/v1/identify`, {
            method: 'POST',
            body: acrFormData,
        });

        const acrData = await acrResponse.json();
        console.log('ACRCloud Response:', JSON.stringify(acrData, null, 2));

        if (acrData.status.code !== 0) {
            console.log('ACRCloud Error Code:', acrData.status.code, acrData.status.msg);
            return NextResponse.json({
                identified: false,
                message: acrData.status.msg
            });
        }

        const metadata = acrData.metadata;
        if (!metadata || !metadata.music || metadata.music.length === 0) {
            console.log('No music found in metadata');
            return NextResponse.json({ identified: false, message: 'No music found' });
        }

        const music = metadata.music[0];
        console.log('Identified Music:', music.title);
        const trackName = music.title;
        const artistName = music.artists[0].name;
        const albumName = music.album.name;
        const durationMs = music.duration_ms;
        const playOffsetMs = music.play_offset_ms;

        // 2. Fetch Lyrics from LRCLIB
        let lyrics = null;
        try {
            const lyricsResponse = await fetch(
                `${LRCLIB_API_URL}/get?artist_name=${encodeURIComponent(artistName)}&track_name=${encodeURIComponent(trackName)}&album_name=${encodeURIComponent(albumName)}&duration=${durationMs / 1000}`
            );

            if (lyricsResponse.ok) {
                lyrics = await lyricsResponse.json();
            } else {
                // Fallback search if exact match fails
                const searchResponse = await fetch(
                    `${LRCLIB_API_URL}/search?q=${encodeURIComponent(trackName + ' ' + artistName)}`
                );
                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    if (searchData && searchData.length > 0) {
                        lyrics = searchData[0];
                    }
                }
            }
        } catch (error) {
            console.error('Lyrics fetch error:', error);
        }

        return NextResponse.json({
            identified: true,
            track: {
                name: trackName,
                artist: artistName,
                album: albumName,
                durationMs,
                playOffsetMs,
                sampleDurationMs: music.sample_end_time_offset_ms || 12000,
                score: music.score,
            },
            lyrics: lyrics
        });

    } catch (error) {
        console.error('Identification error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
