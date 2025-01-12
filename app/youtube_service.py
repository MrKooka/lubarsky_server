from googleapiclient.discovery import build
import os
from dotenv import load_dotenv

load_dotenv()
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY')


def fetch_channel_videos(channel_id, max_results=50):
    """
    Fetches videos (with thumbnails) from a channel's "uploads" playlist.
    """
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    
    # 1. Get the channel's "uploads" playlist
    channel_response = youtube.channels().list(
        part='contentDetails',
        id=channel_id
    ).execute()
    
    if not channel_response.get('items'):
        return []  # or handle error if channel not found

    uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']
    
    # 2. Fetch videos from that playlist
    videos_response = youtube.playlistItems().list(
        part='snippet',
        playlistId=uploads_playlist_id,
        maxResults=max_results
    ).execute()
    
    video_items = videos_response.get('items', [])
    video_details = []
    
    for item in video_items:
        snippet = item['snippet']
        resource_id = snippet.get('resourceId', {})
        video_id = resource_id.get('videoId', '')
        
        # Fallback logic for thumbnails
        thumbnails = snippet.get('thumbnails', {})
        thumbnail_url = None
        for size in ("standard", "high", "medium", "default"):
            size_obj = thumbnails.get(size)
            if size_obj and "url" in size_obj:
                thumbnail_url = size_obj["url"]
                break

        video_details.append({
            'video_id': video_id,
            'title': snippet.get('title', ''),
            'published_at': snippet.get('publishedAt', ''),
            'thumbnail_url': thumbnail_url
        })
    
    return video_details



def fetch_playlist_videos(playlist_id, max_results=50):
    """
    Fetches videos from a given playlist ID using the YouTube Data API.

    Args:
        playlist_id (str): The ID of the YouTube playlist (e.g., "PL12345").
        max_results (int): Number of results per page request (default: 50).

    Returns:
        list: A list of dictionaries containing video_id, title, published_at, and thumbnail_url
              for each video in the playlist.
    """
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    
    video_details = []
    
    request = youtube.playlistItems().list(
        part='snippet',
        playlistId=playlist_id,
        maxResults=max_results
    )
    
    while request:
        response = request.execute()
        
        for item in response.get('items', []):
            snippet = item.get('snippet', {})
            resource_id = snippet.get('resourceId', {})
            video_id = resource_id.get('videoId')
            
            # Only append if we have a valid video_id (it might be missing for some items)
            if video_id:
                # Extract thumbnail_url similar to fetch_channel_videos
                thumbnails = snippet.get('thumbnails', {})
                thumbnail_url = None
                for size in ("standard", "high", "medium", "default"):
                    size_obj = thumbnails.get(size)
                    if size_obj and "url" in size_obj:
                        thumbnail_url = size_obj["url"]
                        break
                
                video_details.append({
                    'video_id': video_id,
                    'title': snippet.get('title', ''),
                    'published_at': snippet.get('publishedAt', ''),
                    'thumbnail_url': thumbnail_url  # Added thumbnail URL
                })
        
        # Paginate if more results
        request = youtube.playlistItems().list_next(request, response)
    
    return video_details

def fetch_video_comments(video_id, max_results=100):
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    comments = []

    request = youtube.commentThreads().list(
        part="snippet,replies",
        videoId=video_id,
        textFormat="plainText",
        maxResults=max_results
    )

    while request:
        response = request.execute()
        for item in response.get('items', []):
            comment_snippet = item['snippet']['topLevelComment']['snippet']
            comments.append({
                'author': comment_snippet['authorDisplayName'],
                'text': comment_snippet['textDisplay'],
                'published_at': comment_snippet['publishedAt']
            })
            # If replies exist
            replies = item.get('replies', {}).get('comments', [])
            for reply in replies:
                reply_snippet = reply['snippet']
                comments.append({
                    'author': reply_snippet['authorDisplayName'],
                    'text': reply_snippet['textDisplay'],
                    'published_at': reply_snippet['publishedAt']
                })
        
        # Paginate if more results
        if 'nextPageToken' in response:
            request = youtube.commentThreads().list(
                part="snippet,replies",
                videoId=video_id,
                textFormat="plainText",
                maxResults=max_results,
                pageToken=response['nextPageToken']
            )
        else:
            request = None

    return comments

def get_channel_playlists(channel_id, max_results=50):
    """
    Fetch all playlists for a given YouTube channel.

    Args:
        channel_id (str): The ID of the YouTube channel (usually starts with 'UC').
        max_results (int): The maximum number of playlists to fetch per request (default: 50).

    Returns:
        list of dict: A list of dictionaries containing:
            - id (str): The playlist ID
            - title (str): The playlist title
            - description (str): The playlist description
            - picture (str or None): URL to the best-available thumbnail
    """
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    playlists = []

    request = youtube.playlists().list(
        part='snippet',
        channelId=channel_id,
        maxResults=max_results
    )

    while request:
        response = request.execute()
        for item in response.get('items', []):
            snippet = item.get('snippet', {})
            thumbnails = snippet.get('thumbnails', {})

            # Fallback sequence for different thumbnail sizes
            picture_url = None
            for size in ["standard", "high", "medium", "default"]:
                thumb_obj = thumbnails.get(size)
                if thumb_obj and "url" in thumb_obj:
                    picture_url = thumb_obj["url"]
                    break

            playlists.append({
                "id": item["id"],
                "title": snippet.get("title", ""),
                "description": snippet.get("description", ""),
                "picture": picture_url
            })
        
        # Handle pagination if there's another page
        request = youtube.playlists().list_next(request, response)

    return playlists

