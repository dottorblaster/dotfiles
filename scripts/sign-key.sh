#!/bin/sh

if [[ ( $@ == "--help") ||  $@ == "-h" ]]
then 
	echo "Usage: $0 [arguments]"
	exit 0
fi

gpg --keyserver keyserver.ubuntu.com --recv-keys $1
gpg --sign-key $1
gpg --keyserver keyserver.ubuntu.com --send-keys $1
