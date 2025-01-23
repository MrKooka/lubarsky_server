from googleapiclient.discovery import build
import os
from dotenv import load_dotenv
from typing import List, Dict, Any
import re 
from app.services.logging_service import setup_logger

logger = setup_logger("app.youtube_service.")

load_dotenv()
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY')


def get_youtube_video_id_from_url(url):
    regex = re.compile(
        r'(https?://)?'
        r'(www\.)?'  
        r'(youtube|youtu|youtube-nocookie)\.'  
        r'(com|be)/'  
        r'(watch\?v=|embed/|v/|.+\?v=)?'  
        r'(?P<id>[A-Za-z0-9\-=_]{11})'  
    )
    match = regex.search(url)
    id_ = match.group("id")
    if match:
        logger.debug(f"regex complited resuld: {id_}")
        return match.group("id")
    else:
        logger.debug("no Match")
        return None


def fetch_channel_videos(channel_id: str, max_results: int = 10, page_token: str = None) -> Dict[str, Any]:
    """
    Fetches videos from a channel's uploads playlist.

    Args:
        channel_id (str): The YouTube channel ID.
        max_results (int, optional): Number of videos per request. Defaults to 10.
        page_token (str, optional): Token for pagination. Defaults to None.

    Returns:
        Dict[str, Any]: Dictionary containing videos, hasMore flag, and nextPageToken.
    """
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

    # 1. Get the channel's uploads playlist ID
    channel_response = youtube.channels().list(
        part='contentDetails',
        id=channel_id
    ).execute()

    if not channel_response.get('items'):
        return {
            'videos': [],
            'hasMore': False,
            'nextPageToken': None,
            'message': 'Channel not found.'
        }

    uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists'].get('uploads')

    if not uploads_playlist_id:
        return {
            'videos': [],
            'hasMore': False,
            'nextPageToken': None,
            'message': 'Uploads playlist not found for this channel.'
        }

    # 2. Fetch videos from the uploads playlist
    videos_response = youtube.playlistItems().list(
        part='snippet',
        playlistId=uploads_playlist_id,
        maxResults=max_results,
        pageToken=page_token
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

    # Check if there are more pages
    next_page_token = videos_response.get('nextPageToken', None)
    has_more = next_page_token is not None

    return {
        'videos': video_details,
        'hasMore': has_more,
        'nextPageToken': next_page_token
    }

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

def fetch_video_details(video_id):
    """
    Fetches detailed information about a YouTube video using its Video ID.

    Args:
        video_id (str): The unique identifier for the YouTube video.

    Returns:
        dict: A dictionary containing video details.
    """
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

    try:
        request = youtube.videos().list(
            part='snippet,contentDetails,statistics,status',
            id=video_id
        )
        response = request.execute()

        items = response.get('items')
        if not items:
            print(f"No video found with Video ID: {video_id}")
            return None

        video = items[0]

        # Extracting necessary details
        video_details = {
            'video_id': video.get('id'),
            'title': video['snippet'].get('title'),
            'description': video['snippet'].get('description'),
            'published_at': video['snippet'].get('publishedAt'),
            'channel_id': video['snippet'].get('channelId'),
            'channel_title': video['snippet'].get('channelTitle'),
            'category_id': video['snippet'].get('categoryId'),
            'thumbnail_url': video['snippet']['thumbnails']['high']['url'] if 'high' in video['snippet']['thumbnails'] else None,
            'tags': video['snippet'].get('tags', []),
            'duration': video['contentDetails'].get('duration'),
            'dimension': video['contentDetails'].get('dimension'),
            'definition': video['contentDetails'].get('definition'),
            'caption': video['contentDetails'].get('caption'),
            'licensed_content': video['contentDetails'].get('licensedContent'),
            'projection': video['contentDetails'].get('projection'),
            'view_count': video['statistics'].get('viewCount'),
            'like_count': video['statistics'].get('likeCount'),
            'dislike_count': video['statistics'].get('dislikeCount'),
            'favorite_count': video['statistics'].get('favoriteCount'),
            'comment_count': video['statistics'].get('commentCount'),
            'privacy_status': video['status'].get('privacyStatus'),
            'license': video['status'].get('license'),
            'embeddable': video['status'].get('embeddable'),
            'public_stats_viewable': video['status'].get('publicStatsViewable'),
        }

        return video_details

    except Exception as e:
        print(f"An error occurred: {e}")
        return None


def search_channels(handle, max_results=5):
    """
    Searches for YouTube channels matching the provided handle.

    Args:
        handle (str): The YouTube channel handle (e.g., "@johnnyharris").
        max_results (int): Maximum number of results to return.

    Returns:
        list: A list of dictionaries containing channel details.
    """
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    
    try:
        request = youtube.search().list(
            part='snippet',
            q=handle,
            type='channel',
            maxResults=max_results
        )
        response = request.execute()
        
        channels = []
        for item in response.get('items', []):
            channel = {
                'channel_id': item['id']['channelId'],
                'title': item['snippet']['title'],
                'description': item['snippet']['description'],
                'thumbnail_url': item['snippet']['thumbnails']['high']['url'] if 'high' in item['snippet']['thumbnails'] else None,
            }
            channels.append(channel)
        
        return channels
    
    except Exception as e:
        print(f"An error occurred while searching channels: {e}")
        return []