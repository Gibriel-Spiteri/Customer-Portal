#!/usr/bin/env bash
# Assembles the instructional walkthrough video from recorded clips.
set -euo pipefail
cd "$(dirname "$0")/.."

RAW=tmp/video/raw
SEG=tmp/video/seg
OUT=tmp/video/portal-feature-tour.mp4
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
FONTB=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
W=1080; H=1920
NAVY=0x1B2A4A

rm -rf "$SEG"; mkdir -p "$SEG"

# title_card <out> <dur> <line1> <line2>
title_card() {
  ffmpeg -y -v error -f lavfi -i "color=c=$NAVY:s=${W}x${H}:d=$2:r=30" \
    -vf "drawtext=fontfile=$FONTB:text='$3':fontcolor=white:fontsize=76:x=(w-text_w)/2:y=(h/2)-120,drawtext=fontfile=$FONT:text='$4':fontcolor=0xBBD0F0:fontsize=46:x=(w-text_w)/2:y=(h/2)+20,fade=t=in:st=0:d=0.5,fade=t=out:st=$(echo "$2-0.5"|bc):d=0.5" \
    -c:v libx264 -pix_fmt yuv420p -r 30 "$1"
}

# section <name> <title> <cap1> <cap2>
section() {
  local d
  d=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$RAW/$1.webm")
  d=$(echo "$d-1.5"|bc)
  ffmpeg -y -v error -ss 1.5 -i "$RAW/$1.webm" -vf "\
scale=-2:1500,pad=$W:$H:(ow-iw)/2:340:white,\
drawbox=x=0:y=0:w=$W:h=340:color=$NAVY:t=fill,\
drawtext=fontfile=$FONTB:text='$2':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=70,\
drawtext=fontfile=$FONT:text='$3':fontcolor=0xBBD0F0:fontsize=40:x=(w-text_w)/2:y=170,\
drawtext=fontfile=$FONT:text='$4':fontcolor=0xBBD0F0:fontsize=40:x=(w-text_w)/2:y=235,\
fade=t=in:st=0:d=0.4,fade=t=out:st=$(echo "$d-0.4"|bc):d=0.4" \
    -c:v libx264 -pix_fmt yuv420p -r 30 "$SEG/$1.mp4"
}

title_card "$SEG/00-intro.mp4"  3.5 "CONSUMERS PRO" "Customer Portal Feature Tour"
title_card "$SEG/10-t.mp4" 2.5 "Estimates" "Your price quotes, one tap away"
section estimates "Estimates" "Tap Estimates in the bottom bar" "Tap any estimate to open full details"
title_card "$SEG/20-t.mp4" 2.5 "Sales Orders" "Track every order"
section orders "Sales Orders" "Tab through Active, Ready and Completed" "Tap an order to see full details"
title_card "$SEG/30-t.mp4" 2.5 "Consumers Cash" "Your rebate rewards"
section cash "Consumers Cash" "See your available balance and rebate level" "Scroll down to check your history"
title_card "$SEG/40-t.mp4" 2.5 "Get a Project Quote" "Pick how you would like to work with us"
section quote "Get a Project Quote" "Tell us about the project" "We get you the quote. You get the sale."
title_card "$SEG/50-t.mp4" 2.5 "Express Bath Inventory" "In-stock and ready to go"
section bath "Express Bath" "Tap Express Bath in the menu" "Browse live inventory with prices"
title_card "$SEG/90-outro.mp4" 3.5 "ckbproportal.com" "Log in and take it for a spin"

ls "$SEG"/*.mp4 | sort | sed "s/^/file '..\/..\/..\/&'/" > "$SEG/list.txt"
# use absolute paths for concat
ls -d "$PWD/$SEG"/*.mp4 | sort | awk '{print "file \x27" $0 "\x27"}' > "$SEG/list.txt"
ffmpeg -y -v error -f concat -safe 0 -i "$SEG/list.txt" -c copy "$OUT"
ffprobe -v quiet -show_entries format=duration,size -of default=nw=1 "$OUT"
echo "DONE $OUT"
