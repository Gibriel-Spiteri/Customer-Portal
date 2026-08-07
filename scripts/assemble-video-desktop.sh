#!/usr/bin/env bash
# Assembles the instructional walkthrough video from recorded clips.
set -euo pipefail
cd "$(dirname "$0")/.."

RAW=tmp/video/raw-desktop
SEG=tmp/video/seg-desktop
OUT=tmp/video/portal-feature-tour-desktop.mp4
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
FONTB=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
FONTD=tmp/fonts/Anton.ttf   # bold condensed title font (Impact-like)
LOGO=attached_assets/CKBPRO_LOGO_1783790758560-Du6WJwuG_1785944939787.png
MUSIC=tmp/video/music.mp3
W=1920; H=1080
NAVY=0x1B2A4A
SPEED=1.3   # screen captures play this much faster
TRIM=2.8    # seconds trimmed from clip start (desktop pages render slower)

rm -rf "$SEG"; mkdir -p "$SEG"

# semi-transparent watermark of the logo, prepared once
ffmpeg -y -v error -i "$LOGO" -vf "scale=220:-1,format=rgba,lutrgb=r=255:g=255:b=255,colorchannelmixer=aa=0.18" "$SEG/wm.png"

# Intro: white card with the CKB PRO logo + subtitle
ffmpeg -y -v error -f lavfi -i "color=c=white:s=${W}x${H}:d=3.5:r=30" -i "$LOGO" \
  -filter_complex "[1:v]scale=760:-1[logo];[0:v][logo]overlay=(W-w)/2:(H-h)/2-80,drawtext=fontfile=$FONT:text='Customer Portal Feature Tour':fontcolor=$NAVY:fontsize=52:x=(w-text_w)/2:y=(h/2)+90,fade=t=in:st=0:d=0.5,fade=t=out:st=3:d=0.5" \
  -c:v libx264 -pix_fmt yuv420p -r 30 "$SEG/00-intro.mp4"

# title_card <out> <dur> <line1> <line2 = benefit>
title_card() {
  ffmpeg -y -v error -f lavfi -i "color=c=$NAVY:s=${W}x${H}:d=$2:r=30" -i "$SEG/wm.png" \
    -filter_complex "[0:v][1:v]overlay=50:H-h-50,drawtext=fontfile=$FONTD:text='$3':fontcolor=white:fontsize=96:x=(w-text_w)/2:y=(h/2)-130,drawtext=fontfile=$FONT:text='$4':fontcolor=0xBBD0F0:fontsize=42:x=(w-text_w)/2:y=(h/2)+20,fade=t=in:st=0:d=0.4,fade=t=out:st=$(echo "$2-0.4"|bc):d=0.4" \
    -c:v libx264 -pix_fmt yuv420p -r 30 "$1"
}

# section <name> <title> <cap1> <cap2>
# Caption 1 fades out and caption 2 fades in at the moment the recorded action
# happens (timestamps come from the recorder's timings.json).
section() {
  local d sw
  d=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$RAW/$1.webm")
  d=$(echo "($d-$TRIM)/$SPEED"|bc -l)
  sw=$(node -e "const t=require('./$RAW/timings.json')['$1'];console.log(((t-$TRIM)/$SPEED).toFixed(2))")
  ffmpeg -y -v error -ss $TRIM -i "$RAW/$1.webm" -vf "\
setpts=PTS/$SPEED,scale=-2:880,pad=$W:$H:(ow-iw)/2:200:white,\
drawbox=x=0:y=0:w=$W:h=200:color=$NAVY:t=fill,\
drawtext=fontfile=$FONTB:text='$2':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=38,\
drawtext=fontfile=$FONT:text='$3':fontcolor=0xBBD0F0:fontsize=34:x=(w-text_w)/2:y=122:alpha='if(lt(t,$sw-0.4),1,if(lt(t,$sw),($sw-t)/0.4,0))',\
drawtext=fontfile=$FONT:text='$4':fontcolor=0xBBD0F0:fontsize=34:x=(w-text_w)/2:y=122:alpha='if(lt(t,$sw),0,if(lt(t,$sw+0.4),(t-$sw)/0.4,1))',\
fade=t=in:st=0:d=0.35,fade=t=out:st=$(echo "$d-0.35"|bc)':d=0.35" \
    -c:v libx264 -pix_fmt yuv420p -r 30 "$SEG/$1.mp4"
}

title_card "$SEG/10-t.mp4" 2.5 "Estimates" "Access and track all of your open estimates"
section estimates "Estimates" "Tap Estimates on your home screen" "Tap any estimate to open full details"
title_card "$SEG/20-t.mp4" 2.5 "Sales Orders" "Always know where your order stands"
section orders "Sales Orders" "Tab through Active, Ready and Completed" "Tap an order to see full details"
title_card "$SEG/30-t.mp4" 2.5 "Consumers Cash" "Track your volume rebate earnings"
section cash "Consumers Cash" "See your balance and rebate level" "Scroll down to check your history"
title_card "$SEG/40-t.mp4" 2.5 "Get a Project Quote" "You get the sale. We do the work."
section quote "Get a Project Quote" "Pick how you want to work with us" "Tell us about the project — we do the rest"
title_card "$SEG/50-t.mp4" 2.5 "Express Bath" "In-stock product you can sell today"
section bath "Express Bath" "Tap Express Bath in the menu" "Browse live inventory with prices"
ffmpeg -y -v error -f lavfi -i "color=c=$NAVY:s=${W}x${H}:d=3.5:r=30" -i "$SEG/wm.png" \
  -filter_complex "[0:v][1:v]overlay=50:H-h-50,drawtext=fontfile=$FONTD:text='Log in and take it for a spin':fontcolor=white:fontsize=68:x=(w-text_w)/2:y=(h/2)-40,fade=t=in:st=0:d=0.4,fade=t=out:st=3.1:d=0.4" \
  -c:v libx264 -pix_fmt yuv420p -r 30 "$SEG/90-outro.mp4"

mv "$SEG/estimates.mp4" "$SEG/11-estimates.mp4"
mv "$SEG/orders.mp4"    "$SEG/21-orders.mp4"
mv "$SEG/cash.mp4"      "$SEG/31-cash.mp4"
mv "$SEG/quote.mp4"     "$SEG/41-quote.mp4"
mv "$SEG/bath.mp4"      "$SEG/51-bath.mp4"

ls -d "$PWD/$SEG"/*.mp4 | sort | awk '{print "file \x27" $0 "\x27"}' > "$SEG/list.txt"
ffmpeg -y -v error -f concat -safe 0 -i "$SEG/list.txt" -c copy "$SEG/silent.mp4"

D=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$SEG/silent.mp4")
ffmpeg -y -v error -i "$SEG/silent.mp4" -stream_loop -1 -i "$MUSIC" \
  -filter_complex "[1:a]volume=0.55,afade=t=in:st=0:d=1,afade=t=out:st=$(echo "$D-2"|bc):d=2[a]" \
  -map 0:v -map "[a]" -t "$D" -c:v copy -c:a aac -b:a 160k "$OUT"
ffprobe -v quiet -show_entries format=duration,size -of default=nw=1 "$OUT"
echo "DONE $OUT"
