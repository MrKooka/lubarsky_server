#!/usr/bin/env python3
"""
1) Download a YouTube video using yt-dlp.
2) Optionally convert it to:
   - another video format, or
   - one of the 10 supported audio formats: ['flac', 'm4a', 'mp3', 'mp4',
     'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm']
   with an emphasis on "making the audio file as small as possible"
   if the user chooses a lossy format.

Features:
  - Deep logging (to console + "video_downloader.log").
  - Iterative bitrate reduction to fit under a user-specified MB limit (for lossy codecs).
  - Menu describing which format likely yields minimal file size, etc.
  - Very user-friendly CLI.

Prerequisites:
  pip install yt-dlp
  FFmpeg installed (https://ffmpeg.org/)
  (Optional) For advanced HE-AAC: ffmpeg compiled with --enable-libfdk_aac

Usage:
  python youtube_downloader.py
  Follow the prompts.
"""

import logging
import os
import subprocess
import sys
import datetime
import yt_dlp

# ------------------------------------------------------------------------------
# Configure Logging
# ------------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG,  # Capture all logs: DEBUG, INFO, WARNING, ERROR, CRITICAL
    format='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
    handlers=[
        logging.FileHandler("video_downloader.log", mode='a', encoding='utf-8'),
        logging.StreamHandler(sys.stdout),  # Also print to console
    ]
)
logger = logging.getLogger("YouTubeDownloader")


def progress_hook(d):
    """
    Progress hook for yt-dlp that logs each download progress event.
    """
    if d['status'] == 'downloading':
        fraction = d.get('_percent_str', '').strip()
        speed = d.get('_speed_str', 'N/A').strip()
        eta = d.get('_eta_str', 'N/A').strip()
        logger.debug(f"Downloading... {fraction} at {speed} ETA: {eta}")
    elif d['status'] == 'finished':
        logger.info("Download complete; now post-processing if needed.")
    elif d['status'] == 'error':
        logger.error("Error during download!")


def download_youtube_video(url: str, download_path: str) -> str:
    """
    Download the highest-quality (audio+video) stream of a YouTube video
    using yt-dlp.

    :param url: The YouTube video URL.
    :param download_path: The directory where the file will be saved.
    :return: Absolute path to the downloaded video file.
    """
    logger.info(f"Starting video download for URL: {url}")
    logger.debug(f"Download path: {download_path}")

    ydl_opts = {
        'format': 'bv+ba/best',  # best video + best audio, fallback to 'best'
        'outtmpl': os.path.join(download_path, '%(title)s.%(ext)s'),
        'logger': logger,
        'progress_hooks': [progress_hook],
        # If you have a cookies file for age-restricted videos:
        # 'cookiefile': '/path/to/cookies.txt',
    }

    os.makedirs(download_path, exist_ok=True)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            logger.info("Extracting video info, about to download...")
            result = ydl.extract_info(url, download=True)
        except yt_dlp.utils.DownloadError as e:
            logger.exception("DownloadError encountered (yt-dlp).")
            raise e
        except Exception as e:
            logger.exception("General exception occurred during download.")
            raise e

    if 'entries' in result:  # If it's a playlist or multiple videos
        video_info = result['entries'][0]
    else:
        video_info = result

    downloaded_filename = ydl.prepare_filename(video_info)
    logger.info(f"Download finished. File saved to: {downloaded_filename}")
    return downloaded_filename


def get_file_size_mb(file_path: str) -> float:
    """
    Return the size of file_path in MB.
    """
    if not os.path.exists(file_path):
        logger.warning(f"File not found: {file_path}")
        return 0.0
    return os.path.getsize(file_path) / (1024 * 1024)


def ffprobe_duration(input_file: str) -> float:
    """
    Return the duration (in seconds) of the file using ffprobe.
    """
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        input_file
    ]
    logger.debug(f"Running ffprobe to get duration: {' '.join(cmd)}")

    try:
        output = subprocess.check_output(cmd, stderr=subprocess.STDOUT).decode().strip()
        duration = float(output)
        logger.debug(f"Duration is {duration} seconds.")
        return duration
    except Exception as e:
        logger.exception("Failed to retrieve media duration.")
        return 0.0


# A dictionary to list the 10 supported formats and short explanations:
SUPPORTED_AUDIO_FORMATS = {
    'flac': {
        'desc': "FLAC (lossless, larger size, no quality loss)",
        'codec': "flac",
        'lossless': True
    },
    'm4a': {
        'desc': "M4A (AAC). Good quality, smaller size than MP3. Requires libfdk_aac for best results.",
        'codec': "libfdk_aac",  # fallback to 'aac' if libfdk not available
        'lossless': False
    },
    'mp3': {
        'desc': "MP3 (older standard, decent quality, bigger than AAC/Opus).",
        'codec': "libmp3lame",
        'lossless': False
    },
    'mp4': {
        'desc': "MP4 container (usually AAC for audio-only). Similar to M4A.",
        'codec': "libfdk_aac",
        'lossless': False
    },
    'mpeg': {
        'desc': "MPEG container (older format, typically MP2). Usually bigger size.",
        'codec': "mp2",
        'lossless': False
    },
    'mpga': {
        'desc': "MPGA (MPEG-1/2 Audio), similar to MP3, older standard.",
        'codec': "libmp3lame",
        'lossless': False
    },
    'oga': {
        'desc': "OGA (Ogg Audio), can contain Vorbis/Opus. Usually smaller size.",
        'codec': "libopus",  # we'll choose Opus for smaller size
        'lossless': False
    },
    'ogg': {
        'desc': "OGG container (often Vorbis or Opus). Very good for minimal size (Opus).",
        'codec': "libopus",
        'lossless': False
    },
    'wav': {
        'desc': "WAV (uncompressed PCM). Huge size, no quality loss.",
        'codec': "pcm_s16le",  # or 'copy' if you want the raw PCM
        'lossless': True
    },
    'webm': {
        'desc': "WebM (commonly uses Opus). Very good for minimal size with Opus.",
        'codec': "libopus",
        'lossless': False
    },
}


def prompt_for_audio_format() -> (str, str, bool):
    """
    Prompt the user to choose one of the 10 supported audio formats, 
    showing short explanations about which ones yield minimal size vs. bigger size.
    
    :return: (chosen_format, recommended_codec, is_lossless)
    """
    print("\nChoose an audio format from the supported list:")
    formats_list = list(SUPPORTED_AUDIO_FORMATS.keys())
    for i, f in enumerate(formats_list, start=1):
        info = SUPPORTED_AUDIO_FORMATS[f]
        print(f"  {i}. {f.upper()} - {info['desc']}")

    choice = None
    while True:
        try:
            pick = int(input(f"Enter your choice (1..{len(formats_list)}): ").strip())
            if 1 <= pick <= len(formats_list):
                choice = formats_list[pick - 1]
                break
            else:
                print(f"Please enter a valid number from 1 to {len(formats_list)}.")
        except ValueError:
            print("Invalid input, please enter a valid integer.")

    chosen_info = SUPPORTED_AUDIO_FORMATS[choice]
    chosen_format = choice  # e.g. 'ogg'
    chosen_codec = chosen_info['codec']  # e.g. 'libopus'
    is_lossless = chosen_info['lossless']
    
    logger.info(f"User chose {chosen_format.upper()} -> {chosen_info['desc']}")
    return chosen_format, chosen_codec, is_lossless


def build_ffmpeg_audio_command(
    input_file: str,
    output_file: str,
    codec: str,
    bitrate_kbps: int = 96,
    use_vbr: bool = False
) -> list:
    """
    Build an FFmpeg command list for advanced audio compression or single-pass encoding.

    :param input_file: path to input file
    :param output_file: path to output file
    :param codec: e.g. "libopus", "libfdk_aac", "flac", "libmp3lame", "pcm_s16le"
    :param bitrate_kbps: integer bitrate for CBR (if codec is lossy)
    :param use_vbr: if True (for some codecs like Opus), enable -vbr on
    :return: list of command arguments
    """
    cmd = ["ffmpeg", "-y", "-i", input_file, "-vn"]  # strip video

    if codec == "flac":
        # FLAC is lossless
        cmd.extend(["-c:a", "flac"])
        # Optionally: -compression_level 12 for smallest possible (slow)
        # cmd.extend(["-compression_level", "12"])

    elif codec == "pcm_s16le":
        # WAV (uncompressed). 
        cmd.extend(["-c:a", "pcm_s16le"])

    elif codec == "libopus":
        cmd.extend(["-c:a", "libopus"])
        if use_vbr:
            cmd.extend(["-vbr", "on"])   # enable variable bitrate for Opus
        cmd.extend(["-b:a", f"{bitrate_kbps}k"])

    elif codec == "libfdk_aac":
        # HE-AAC v2 if you do: -profile:a aac_he_v2
        # We'll keep it simpler for demonstration:
        cmd.extend(["-c:a", "libfdk_aac", "-profile:a", "aac_he_v2"])
        cmd.extend(["-b:a", f"{bitrate_kbps}k"])

    elif codec == "mp2":
        # older MPEG audio
        cmd.extend(["-c:a", "mp2", "-b:a", f"{bitrate_kbps}k"])

    elif codec == "libmp3lame":
        # MP3
        cmd.extend(["-c:a", "libmp3lame", "-b:a", f"{bitrate_kbps}k"])

    else:
        # fallback or anything else
        cmd.extend(["-c:a", codec, "-b:a", f"{bitrate_kbps}k"])

    cmd.append(output_file)
    return cmd


def compress_audio_extreme(
    input_file: str,
    chosen_format: str,
    chosen_codec: str,
    is_lossless: bool,
    max_size_mb: float = None,
    initial_bitrate_kbps: int = 96,
    min_bitrate_kbps: int = 32,
    use_vbr: bool = False
) -> str:
    """
    Convert the media to one of the 10 supported audio formats with optional iterative 
    approach if it's a lossy codec and user wants to keep under max_size_mb.

    :param input_file: original video file
    :param chosen_format: e.g. 'ogg', 'webm', 'm4a', etc.
    :param chosen_codec: e.g. 'libopus', 'libfdk_aac', 'flac', 'pcm_s16le'
    :param is_lossless: True if FLAC or WAV
    :param max_size_mb: if provided, tries to keep final file under this size
    :param initial_bitrate_kbps: start bitrate for iterative approach
    :param min_bitrate_kbps: min allowed bitrate
    :param use_vbr: if True, we pass -vbr on (currently for Opus)
    :return: path to final compressed file or empty string on failure
    """
    logger.info("Starting advanced audio compression...")

    base, _ = os.path.splitext(input_file)
    out_file_base = f"{base}.{chosen_format}"

    # Avoid overwriting existing file
    if os.path.exists(out_file_base):
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        out_file_base = f"{base}_{timestamp}.{chosen_format}"

    # Single pass if:
    # 1) It's lossless (FLAC or WAV), or
    # 2) no max_size_mb specified
    if is_lossless or not max_size_mb:
        logger.info("Single-pass mode. Either lossless or no size constraint.")
        cmd = build_ffmpeg_audio_command(
            input_file=input_file,
            output_file=out_file_base,
            codec=chosen_codec,
            bitrate_kbps=initial_bitrate_kbps,
            use_vbr=use_vbr
        )
        logger.debug(f"FFmpeg command: {' '.join(cmd)}")

        try:
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as e:
            logger.exception("FFmpeg conversion failed!")
            raise RuntimeError("Audio conversion failed.") from e

        final_size_mb = get_file_size_mb(out_file_base)
        logger.info(
            f"Final audio file: {out_file_base} ({final_size_mb:.2f} MB)."
        )
        return out_file_base

    # Otherwise, we do an iterative approach for lossy compression.
    original_size_mb = get_file_size_mb(input_file)
    logger.debug(f"Original file size: {original_size_mb:.2f} MB")

    current_bitrate = initial_bitrate_kbps
    attempt_path = ""

    while True:
        short_ts = datetime.datetime.now().strftime("%H%M%S")
        attempt_path = f"{base}_{current_bitrate}k_{short_ts}.{chosen_format}"

        cmd = build_ffmpeg_audio_command(
            input_file=input_file,
            output_file=attempt_path,
            codec=chosen_codec,
            bitrate_kbps=current_bitrate,
            use_vbr=use_vbr
        )
        logger.info(f"Trying {current_bitrate} kbps => {attempt_path}")
        logger.debug(f"FFmpeg command: {' '.join(cmd)}")

        try:
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as e:
            logger.exception("FFmpeg conversion failed at this bitrate!")
            raise RuntimeError("Audio conversion failed.") from e

        final_size_mb = get_file_size_mb(attempt_path)
        logger.info(
            f"Finished compression at {current_bitrate} kbps. "
            f"File size = {final_size_mb:.2f} MB"
        )

        if original_size_mb > 0:
            ratio = (final_size_mb / original_size_mb) * 100
            logger.info(f"Compression ratio vs. original: {ratio:.2f}%")

        if final_size_mb <= max_size_mb:
            logger.info(
                f"Success: final audio file under {max_size_mb} MB "
                f"({final_size_mb:.2f} MB)."
            )
            break
        else:
            logger.warning(
                f"File is {final_size_mb:.2f} MB, exceeds {max_size_mb} MB limit. "
                "Reducing bitrate and retrying..."
            )
            os.remove(attempt_path)
            current_bitrate = int(current_bitrate * 0.85)
            if current_bitrate < min_bitrate_kbps:
                logger.error(
                    f"Reached minimal bitrate of {min_bitrate_kbps}k "
                    "and still above size limit. Stopping."
                )
                attempt_path = ""
                break

    return attempt_path


def convert_video(input_file: str, output_ext: str) -> str:
    """
    Convert video to a new container/codec (keeping both video & audio),
    no iterative approach.

    :param input_file: Path to the input video file.
    :param output_ext: e.g. 'mp4', 'mkv', 'avi', etc.
    :return: Path to the converted file.
    """
    logger.info(f"Converting video to format: {output_ext}")
    base, _ = os.path.splitext(input_file)
    output_file = f"{base}.{output_ext}"

    if os.path.exists(output_file):
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"{base}_{timestamp}.{output_ext}"

    cmd = ["ffmpeg", "-y", "-i", input_file, output_file]
    logger.debug(f"FFmpeg command: {' '.join(cmd)}")

    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        logger.exception("FFmpeg video conversion failed!")
        raise RuntimeError("Video conversion failed.") from e

    final_size_mb = get_file_size_mb(output_file)
    logger.info(
        f"Video conversion successful. Output file: {output_file} "
        f"({final_size_mb:.2f} MB)"
    )
    return output_file


def main():
    logger.info("Script started. Prompting user for input.")
    print("Welcome to the YouTube Downloader & Audio Converter!\n")

    # 1) Prompt for the YouTube URL
    video_url = input("Please enter the YouTube video URL: ").strip()

    # 2) Prompt for download directory
    download_path = input("Enter download directory (or press Enter for current folder): ").strip()
    if not download_path:
        download_path = os.getcwd()

    # 3) Download
    try:
        downloaded_file = download_youtube_video(video_url, download_path)
    except Exception as e:
        logger.error(f"Failed to download video. Reason: {e}")
        print("Download failed. Check the log for details.")
        sys.exit(1)

    # 4) Ask user about conversion
    print("\nSelect an operation:")
    print("1. No conversion (keep original file)")
    print("2. Convert to another video format (e.g. mkv, avi, etc.)")
    print("3. Convert to one of the 10 supported audio formats")
    choice = input("Enter your choice (1/2/3): ").strip()

    if choice == '1':
        logger.info("User chose no conversion. Exiting.")
        print("Video downloaded successfully, no further action.")
        sys.exit(0)

    elif choice == '2':
        ext = input("Enter desired video extension (e.g., mp4, mkv, avi): ").lower().strip()
        try:
            new_file = convert_video(downloaded_file, ext)
            print(f"Video converted successfully to: {new_file}")
        except RuntimeError:
            print("Video conversion failed. Check log for details.")
        sys.exit(0)

    elif choice == '3':
        # Prompt user for one of the 10 allowed audio formats
        chosen_format, chosen_codec, is_lossless = prompt_for_audio_format()

        # If using Opus (e.g. 'ogg', 'webm'), we can ask about VBR
        use_vbr = False
        if chosen_codec == "libopus":
            ask_vbr = input("Enable variable bitrate (VBR) for Opus? (y/n): ").lower().strip()
            if ask_vbr in ['y', 'yes']:
                use_vbr = True
                logger.info("User enabled VBR for Opus.")

        # Prompt for optional max size
        max_size = input(
            "Enter a maximum file size in MB (e.g. '25') to do iterative compression, "
            "or press Enter to skip: "
        ).strip()

        max_size_float = None
        if max_size:
            try:
                max_size_float = float(max_size)
            except ValueError:
                logger.warning("Invalid max size input. Skipping size constraint.")

        try:
            final_audio = compress_audio_extreme(
                input_file=downloaded_file,
                chosen_format=chosen_format,
                chosen_codec=chosen_codec,
                is_lossless=is_lossless,
                max_size_mb=max_size_float,
                initial_bitrate_kbps=96,
                min_bitrate_kbps=32,
                use_vbr=use_vbr
            )
            if final_audio and os.path.exists(final_audio):
                final_size_mb = get_file_size_mb(final_audio)
                print(
                    f"\nAudio compressed successfully to: {final_audio} "
                    f"({final_size_mb:.2f} MB)."
                )
                logger.info(f"Final audio file: {final_audio} ({final_size_mb:.2f} MB)")
            else:
                print(
                    "\nAudio compression did not produce a final file. "
                    "Check the logs for details."
                )
        except RuntimeError:
            print("Audio conversion failed. Check log for details.")

    logger.info("Script finished.")
    print("\nAll done! Check 'video_downloader.log' for a very detailed record of every step.")


if __name__ == "__main__":
    main()
