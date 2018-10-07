const YouTube = require('simple-youtube-api'),
  moment = require('moment'),
  ytdl = require('ytdl-core'),
  {Command} = require('discord.js-commando'),
  {escapeMarkdown} = require('discord.js'),
  {Song,error} = require('../../utils.js');

module.exports = class PlaySongCommand extends Command {
    constructor (client) {
      super(client, {
        name: 'play',
        memberName: 'play',
        group: 'musique',
        description: 'Pemret de lancer une musique',
        examples: ['play {youtube video to play}'],
        guildOnly: true,
        args: [
          {
            key: 'url',
            prompt: 'Quelle musique voulez vous écouter',
            type: 'string',
            parse: p => p.replace(/<(.+)>/g, '$1')
          }
        ]
      });
  
      this.queue = new Map();
      this.youtube = new YouTube(process.env.youtube_api);
    }
  
    async run (msg, {url}) {
      const queue = this.queue.get(msg.guild.id);
  
      let voiceChannel;
  
      if (!queue) {
        voiceChannel = msg.member.voice.channel;
        if (!voiceChannel) {
          return msg.reply(error('Veuillez rejoindre un salon vocal pour lancer une musique.'));
        }
  
        const permissions = voiceChannel.permissionsFor(msg.client.user);
  
        if (!permissions.has('CONNECT')) {
          return msg.reply(error('Je n\'ai pas la permission de rejoindre un salon vocal. Merci de régler ce petit soucis 😉'));
        }
        if (!permissions.has('SPEAK')) {
          return msg.reply(error('Je n\'ai pas la permission de parler dans un salon vocal. Merci de régler ce petit soucis 😉'));
        }
      } else if (!queue.voiceChannel.members.has(msg.author.id)) {
        return msg.reply(error('Veuillez rejoindre un salon vocal pour lancer une musique.'));
      }
  
      const statusMsg = await msg.reply('obtaining video details...');
  
      if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
        await statusMsg.edit('obtaining playlist videos... (this can take a while for long lists)');
        const playlist = await this.youtube.getPlaylist(url),
          videos = await playlist.getVideos();
  
        let video2 = null;
  
        if (!queue) {
          const listQueue = {
            textChannel: msg.channel,
            voiceChannel,
            connection: null,
            songs: [],
            volume: 1
          };
  
          this.queue.set(msg.guild.id, listQueue);
  
          statusMsg.edit(`${msg.author}, je rejoinds votre salon vocal...`);
          try {
            const connection = await listQueue.voiceChannel.join();
  
            listQueue.connection = connection;
          } catch (error) {
            console.log(error)
            this.queue.delete(msg.guild.id);
            statusMsg.edit(`${msg.author}, impossible de rejoindre votre salon vocal.`);
  
            return null;
          }
        }
  
        for (const video of Object.values(videos)) {
          try {
            video2 = await this.youtube.getVideoByID(video.id); 
          } catch (err) {
            null;
          }
          await this.handlePlaylist(video2, playlist, queue, voiceChannel, msg, statusMsg);
        }
  
        if (!this.queue.get(msg.guild.id, queue).playing) this.play(msg.guild, this.queue.get(msg.guild.id, queue).songs[0]);
  
        return null;
      }
      try {
        const video = await this.youtube.getVideo(url);
        return this.handleVideo(video, queue, voiceChannel, msg, statusMsg);
      } catch (error) {
        try {
          const videos = await this.youtube.searchVideos(url, 5);
          console.log(videos)
  
          if (!videos[0] || !videos) {
            return statusMsg.edit(`${msg.author}, il n'y a aucun résultats.`);
          }




          const videoByID = await this.youtube.getVideoByID(videos[0].id);
  
          return this.handleVideo(videoByID, queue, voiceChannel, msg, statusMsg);
        } catch (err) {
  
          return statusMsg.edit(`${msg.author}, impossible d'obtenir les détails de la vidéo recherché.`);
        }
      }
    }
  
    async handleVideo (video, queue, voiceChannel, msg, statusMsg) {
      if (moment.duration(video.raw.contentDetails.duration, moment.ISO_8601).asSeconds() === 0) {
        statusMsg.edit(`${msg.author}, vous ne pouvez pas lire les flux en direct.`);
  
        return null;
      }
  
      if (!queue) {
        queue = {
          textChannel: msg.channel,
          voiceChannel,
          connection: null,
          songs: [],
          volume: 1
        };
        this.queue.set(msg.guild.id, queue);
  
        const result = await this.addSong(msg, video),
          resultMessage = {
            color: 0xcd6e57,
            author: {
              name: `${msg.author.tag} (${msg.author.id})`,
              iconURL: msg.author.displayAvatarURL({format: 'png'})
            },
            description: result
          };
  
        if (!result.startsWith('👍')) {
          this.queue.delete(msg.guild.id);
          statusMsg.edit('', {embed: resultMessage});
  
          return null;
        }
  
        statusMsg.edit(`${msg.author}, joining your voice channel...`);
        try {
          const connection = await queue.voiceChannel.join();
  
          queue.connection = connection;
          this.play(msg.guild, queue.songs[0]);
          statusMsg.delete();
  
          return null;
        } catch (error) {
          console.log(error)
          this.queue.delete(msg.guild.id);
          statusMsg.edit(`${msg.author}, unable to join your voice channel.`);
  
          return null;
        }
      } else {
        const result = await this.addSong(msg, video),
          resultMessage = {
            color: 0xcd6e57,
            author: {
              name: `${msg.author.tag} (${msg.author.id})`,
              iconURL: msg.author.displayAvatarURL({format: 'png'})
            },
            description: result
          };
  
        statusMsg.edit('', {embed: resultMessage});
  
        return null;
      }
    }
  
    async handlePlaylist (video, playlist, queue, voiceChannel, msg, statusMsg) {
      if (moment.duration(video.raw.contentDetails.duration, moment.ISO_8601).asSeconds() === 0) {
        statusMsg.edit(`${msg.author}, looks like that playlist has a livestream and I cannot play livestreams`);
  
        return null;
      }
      const result = await this.addSong(msg, video),
        resultMessage = {
          color: 0xcd6e57,
          author: {
            name: `${msg.author.tag} (${msg.author.id})`,
            iconURL: msg.author.displayAvatarURL({format: 'png'})
          },
          description: result
        };
  
      if (!result.startsWith('👍')) {
        this.queue.delete(msg.guild.id);
        statusMsg.edit('', {embed: resultMessage});
  
        return null;
      }
  
      statusMsg.edit('', {
        embed: {
          color: 0xcd6e57,
          author: {
            name: `${msg.author.tag} (${msg.author.id})`,
            icon_url: msg.author.displayAvatarURL({format: 'png'})
          },
          description: `Adding playlist [${playlist.title}](https://www.youtube.com/playlist?list=${playlist.id}) to the queue!\nCheck what's been added with: \`${msg.guild.commandPrefix}queue\`!`
        }
      });
  
      return null;
    }
  
    addSong (msg, video) {
      const queue = this.queue.get(msg.guild.id),
        songNumerator = function (prev, song) {
          if (song.member.id === msg.author.id) {
            prev += 1;
          }
  
          return prev;
        };
  
      if (!this.client.isOwner(msg.author)) {
        if (queue.songs.some(song => song.id === video.id)) {
          return `👎 ${escapeMarkdown(video.title)} is already queued.`;
        }
      }
  
      const song = new Song(video, msg.member);
  
      queue.songs.push(song);
  
      return `👍 ${`[${song}](${`${song.url}`})`}`;
    }
  
    play (guild, song) {
      const queue = this.queue.get(guild.id),
        vote = this.votes.get(guild.id);
  
      if (vote) {
        clearTimeout(vote);
        this.votes.delete(guild.id);
      }
  
      if (!song) {
        queue.textChannel.send('We\'ve run out of songs! Better queue up some more tunes.');
        queue.voiceChannel.leave();
        this.queue.delete(guild.id);
  
        return;
      }
      let streamErrored = false;
  
      const playing = queue.textChannel.send({
          embed: {
            color: 0xcd6e57,
            author: {
              name: song.username,
              iconURL: song.avatar
            },
            description: `${`[${song}](${`${song.url}`})`}`,
            image: {url: song.thumbnail}
          }
        }),
        stream = ytdl(song.url, {
          quality: 'highestaudio',
          filter: 'audioonly',
          highWaterMark: 12
        })
          .on('error', () => {
            streamErrored = true;
            playing.then(msg => msg.edit(`❌ Couldn't play ${song}. What a drag!`));
            queue.songs.shift();
            this.play(guild, queue.songs[0]);
          }),
        dispatcher = queue.connection.play(stream, {
          passes: 5,
          fec: true
        }).on('end', () => {
            if (streamErrored) {
                return;
            }
            queue.songs.shift();
            this.play(guild, queue.songs[0]);
        }).on('error', (err) => {
            queue.textChannel.send(`An error occurred while playing the song: \`${err}\``);
        });
  
      dispatcher.setVolumeLogarithmic(queue.volume / 5);
      song.dispatcher = dispatcher;
      song.playing = true;
      queue.playing = true;
    }
  
    get votes () {
      if (!this._votes) {
        this._votes = this.client.registry.resolveCommand('musique:skip').votes;
      }
  
      return this._votes;
    }
  };