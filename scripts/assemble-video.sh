#!/usr/bin/env bash
# Assembles the instructional walkthrough video from recorded clips.
set -euo pipefail
cd "$(dirname "$0")/.."

RAW=tmp/video/raw
SEG=tmp/video/seg
OUT=tmp/video/portal-feature-tour.mp4
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
FONTB=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
LOGO=attached_assets/CKBPRO_LOGO_1783790758560-Du6WJwuG_1785944939787.png
MUSIC=tmp/video/music.mp3
W=1080; H=1920
NAVY=0x1B2A4A
SPEED=1.3   # screen captures play this much faster

rm -rf "$SEG"; mkdir -p "$SEG"

# Intro: white card with the CKB PRO logo + subtitle
ffmpeg -y -v error -f lavfi -i "color=c=white:s=${W}x${H}:d=3.5:r=30" -i "$LOGO" \
  -filter_complex "[1:v]scale=880:-1[logo];[0:v][logo]overlay=(W-w)/2:(H-h)/2-80,drawtext=fontfile=$FONT:text='Customer Portal Feature Tour':fontcolor=$NAVY:fontsize=52:x=(w-text_w)/2:y=(h/2)+90,fade=t=in:st=0:d=0.5,fade=t=out:st=3:d=0.5" \
  -c:v libx264 -pix_fmt yuv420p -r 30 "$SEG/00-intro.mp4"

# title_card <out> <dur> <line1> <line2 = benefit>
title_card() {
  ffmpeg -y -v error -f lavfi -i "color=c=$NAVY:s=${W}x${H}:d=$2:r=30" \
    -vf "drawtext=fontfile=$FONTB:text='$3':fontcolor=white:fontsize=76:x=(w-text_w)/2:y=(h/2)-120,drawtext=fontfile=$FONT:text='$4':fontcolor=0xBBD0F0:fontsize=44:x=(w-text_w)/2:y=(h/2)+20,fade=t=in:st=0:d=0.4,fade=t=out:st=$(echo "$2-0.4"|bc):d=0.4" \
    -c:v libx264 -pix_fmt yuv420p -r 30 "$1"
}

# section <name> <title> <cap1> <cap2>  (trims 1.5s lead-in, speeds up)
section() {
  local d
  d=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$RAW/$1.webm")
  d=$(echo "($d-1.5)/$SPEED"|bc -l)
  ffmpeg -y -v error -ss 1.5 -i "$RAW/$1.webm" -vf "\
setpts=PTS/$SPEED,scale=-2:1500,pad=$W:$H:(ow-iw)/2:340:white,\
drawbox=x=0:y=0:w=$W:h=340:color=$NAVY:t=fill,\
drawtext=fontfile=$FONTB:text='$2':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=70,\
drawtext=fontfile=$FONT:text='$3':fontcolor=0xBBD0F0:fontsize=40:x=(w-text_w)/2:y=170,\
drawtext=fontfile=$FONT:text='$4':fontcolor=0xBBD0F0:fontsize=40:x=(w-text_w)/2:y=235,\
fade=t=in:st=0:d=0.35,fade=t=out:st=$(echo "$d-0.35"|bc)':d=0.35" \
    -c:v libx264 -pix_fmt yuv420p -r 30 "$SEG/$1.mp4"
}

title_card "$SEG/10-t.mp4" 2.5 "Estimates" "Know your price before the job starts"
section estimates "Estimates" "Tap Estimates in the bottom bar" "Tap any estimate to open full details"
title_card "$SEG/20-t.mp4" 2.5 "Sales Orders" "Always know where your order stands"
section orders "Sales Orders" "Tab through Active, Ready and Completed" "Tap an order to see full details"
title_card "$SEG/30-t.mp4" 2.5 "Consumers Cash" "Earn money back on every purchase"
section cash "Consumers Cash" "See your balance and rebate level" "Scroll down to check your history"
title_card "$SEG/40-t.mp4" 2.5 "Get a Project Quote" "You get the quote. You get the sale."
section quote "Get a Project Quote" "Pick how you want to work with us" "Tell us about the project — we do the rest"
title_card "$SEG/50-t.mp4" 2.5 "Express Bath Inventory" "In-stock product you can sell today"
section bath "Express Bath" "Tap Express Bath in the menu" "Browse live inventory with prices"
title_card "$SEG/90-outro.mp4" 3.5 "ckbproportal.com" "Log in and take it for a spin"

# rename segments so concat order interleaves title -> section
mv "$SEG/estimates.mp4" "$SEG/11-estimates.mp4"
mv "$SEG/orders.mp4"    "$SEG/21-orders.mp4"
mv "$SEG/cash.mp4"      "$SEG/31-cash.mp4"
mv "$SEG/quote.mp4"     "$SEG/41-quote.mp4"
mv "$SEG/bath.mp4"      "$SEG/51-bath.mp4"

ls -d "$PWD/$SEG"/*.mp4 | sort | awk '{print "file \x27" $0 "\x27"}' > "$SEG/list.txt"
ffmpeg -y -v error -f concat -safe 0 -i "$SEG/list.txt" -c copy "$SEG/silent.mp4"

# Mix in background music (looped if short, faded out at the end)
D=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$SEG/silent.mp4")
ffmpeg -y -v error -i "$SEG/silent.mp4" -stream_loop -1 -i "$MUSIC" \
  -filter_complex "[1:a]volume=0.55,afade=t=in:st=0:d=1,afade=t=out:st=$(echo "$D-2"|bc):d=2[a]" \
  -map 0:v -map "[a]" -t "$D" -c:v copy -c:a aac -b:a 160k "$OUT"
ffprobe -v quiet -show_entries format=duration,size -of default=nw=1 "$OUT"
echo "DONE $OUT"
