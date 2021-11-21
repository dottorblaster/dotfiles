#!/bin/sh

if journalctl -u hawck-inputd.service | tail -1 | grep "Deactivated"; then
  echo "Restarting hawck-inputd.service due to deactivated status"
  systemctl restart hawck-inputd
fi
