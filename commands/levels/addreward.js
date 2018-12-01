const {Command} = require('discord.js-commando')
const {removeUserXp,addUserXp,levelImage,getUserXp} = require('../../utils.js');

module.exports = class PrefixCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'setreward',
			memberName: 'setreward',
			group: 'levels',
			aliases: ['addrecompense','addrécompense','addrewards'],
			description: 'Ajouter des récompenses en fonction des niveaux',
			examples: ['xp ajouter DraftMan 3000'],
			args: [{
				key: 'argument',
				prompt: 'Que souhaitez vous faire ? `ajouter`,`add`/`enlever`,`retirer`,`remove`',
				type: 'string',
				validate: v => (/(ajouter|add|enlever|retirer|remove)/i).test(v) ? true : 'doit être une valeur valide, `ajouter`,`add`/`enlever`,`retirer`,`remove`',
				parse: pf => pf.toLowerCase()
			},
			{
				key: 'level',
				prompt: 'Quel est le niveau cible ?',
				type: 'integer'
			},
			{
				key: 'role',
				prompt: 'Quel role est la récompense ?',
				type: 'role'
			}],
			userPermissions: ['ADMINISTRATOR']
		});
	}

	async run(msg, {argument,member,nombre}) {
		if(msg.guild.settings.get('levelSystem') === false) return msg.reply('impossible de modifier l\'xp d\'un membre, les levels ont été désactivés sur ce serveur.')
		if(argument === 'add' || argument === 'ajouter'){
			addUserXp(msg,member.user,nombre).then(response => {
				if(response) msg.reply(`${nombre} xp ont été ajoutés au compte de ${member.user} !`)
			})
		}else if(argument === 'remove' || argument === 'enlever' || argument === 'retirer'){
			removeUserXp(msg,member.user,nombre).then(response => {
				if(response) msg.reply(`${nombre} xp ont été retirés au compte de ${member.user} !`)
			})
		}
	}
};