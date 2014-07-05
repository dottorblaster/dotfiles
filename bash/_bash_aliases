alias push="git push origin"

alias lg='git log --graph --full-history --all --color --pretty=format:"%x1b[31m%h%x09%x1b[32m%d%x1b[0m%x20%s"'

alias gl="git log --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"

# some more ls aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

 
# Remove older kernels in Ubuntu
cleankernels() {
    dpkg -l 'linux-*' | sed '/^ii/!d;/'"$(uname -r | sed "s/\(.*\)-\([^0-9]\+\)/\1/")"'/d;s/^[^ ]* [^ ]* \([^ ]*\).*/\1/;/[0-9]/!d' | xargs sudo apt-get purge
}

# Random commit message from http://whatthecommit.com
rgc() {
    git commit -m"`curl -s http://whatthecommit.com/index.txt`"
}

# JSON pretty print
alias json="python -mjson.tool"