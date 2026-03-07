#!/bin/bash
BASE="src/content/courses/english-beginner/cap01-interactive-stories"

declare -a SECTIONS=(
  "01|presenting-yourself|Presenting Yourself"
  "02|family|Family"
  "03|traveling|Traveling"
  "04|ordering-food|Ordering Food"
  "05|shopping|Shopping"
  "06|raio-app|The RAIO App"
  "07|body-parts|Body Parts"
  "08|movies-tv|Movies & TV"
  "09|animals|Animals"
  "10|culture|Culture"
  "11|exercise|Exercise"
  "12|raio-rules|Las 15 Reglas de RAIO"
  "13|hobbies|Hobbies"
  "14|holidays|Holidays"
  "15|hometown|Hometown"
  "16|work|Work"
  "17|love|Love"
  "18|conversation-classes|Conversation Classes"
  "19|household-items|Household Items"
  "20|time|Time"
  "21|weather|Weather"
  "22|music|Music"
  "23|numbers|Numbers"
  "24|motivation-discipline|Motivation & Discipline"
  "25|politics|Politics"
  "26|fears|Fears"
  "27|feelings|Feelings"
  "28|goals|Goals"
  "29|desires|Desires"
  "30|funny-conversations|Funny Conversations"
  "31|drama|Drama"
  "32|motivation|Motivation"
  "33|psychology|Psychology"
  "34|dates|Dates"
)

for entry in "${SECTIONS[@]}"; do
  IFS="|" read -r num slug title <<< "$entry"
  id="section-${num}-${slug}"
  dir="${BASE}/${id}"
  mkdir -p "$dir"

  cat > "$dir/lesson.json" << EOF
{
  "id": "${id}",
  "title": "${title}",
  "chapterId": "cap01-interactive-stories",
  "order": ${num#0},
  "estimatedMinutes": 8,
  "tags": [],
  "audioNormal": "audio-normal.mp3",
  "audioInteractive": "audio-interactive.mp3",
  "textFile": "text.txt",
  "defaultRepeatTarget": 20,
  "defaultSpeed": 1
}
EOF

  touch "$dir/text.txt"
  touch "$dir/audio-normal.mp3"
  touch "$dir/audio-interactive.mp3"
done

echo "✅ 34 secciones creadas en $BASE"
