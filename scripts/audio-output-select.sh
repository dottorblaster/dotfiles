#!/bin/bash

sinks=$(wpctl status | sed -n '/Sinks:/,/^$/p' | grep -E '^\s*[│├└].*\*?\s*[0-9]+\.' | sed 's/^[^0-9]*//; s/\*//g')

if [ -z "$sinks" ]; then
    notify-send "Audio Output" "No audio outputs found"
    exit 1
fi

formatted_sinks=$(echo "$sinks" | sed 's/\. /: /')

selected=$(echo "$formatted_sinks" | fuzzel --dmenu --prompt "Select Audio Output: ")

if [ -z "$selected" ]; then
    exit 0
fi

sink_id=$(echo "$selected" | grep -oE '^[0-9]+')

if wpctl set-default "$sink_id"; then
    sink_name=$(echo "$selected" | sed 's/^[0-9]*: //')
    notify-send "Audio Output" "Switched to: $sink_name"
else
    notify-send "Audio Output" "Failed to switch output"
    exit 1
fi
