export ZSH="/home/blaster/.oh-my-zsh"

ZSH_THEME="xxf"

plugins=(git)

source $ZSH/oh-my-zsh.sh

export EDITOR=vim

if [ $TILIX_ID ] || [ $VTE_VERSION ]; then
  source /etc/profile.d/vte.sh
fi

export ERL_AFLAGS="-kernel shell_history enabled"

export PATH="/home/blaster/.gem/ruby/3.0.0/bin:$PATH"
export PATH="/home/blaster/.cargo/bin:$PATH"
export PATH="/home/blaster/go/bin:$PATH"
export PATH="/home/blaster/.local/bin:$PATH"

alias docker_clearall='sudo docker rm $(sudo docker ps -a -q) --force'
alias cat='bat -pp'
alias ls='eza'
alias ll='eza -l'
alias vim='nvim'

source /home/blaster/.local/share/lscolors.sh

# Keeping asdf opt-in
function activate_asdf() {
  export PATH="${ASDF_DATA_DIR:-$HOME/.asdf}/shims:$PATH"
}

echo ''
pfetch
