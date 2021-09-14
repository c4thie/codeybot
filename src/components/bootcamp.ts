import { GuildMember, Role, TextChannel, Message, GuildChannel, VoiceState } from 'discord.js';
import { CommandoClient } from 'discord.js-commando';
const Keyv = require('keyv');

const BOOTCAMP_GUILD_ID: string = process.env.BOOTCAMP_GUILD_ID || '.';
export const BootcampSettings = new Keyv();

export const initBootcamp = async (client: CommandoClient): Promise<void> => {
  const bootcamp = await client.guilds.fetch(BOOTCAMP_GUILD_ID);
  const mentorGetRole = <Role>bootcamp.roles.cache.find((role) => role.name === 'Mentor');
  BootcampSettings.set('mentor_role', mentorGetRole.id);
  BootcampSettings.set('critique_time', 30);
};

export const addToMentorList = async (message: Message): Promise<void> => {
  const mentorRole = await BootcampSettings.get('mentor_role');
  message?.guild?.members.cache
  .find((member: GuildMember) => member.user.tag == message.content || member.id == message.content)
  ?.edit({
    roles: [mentorRole]
  });
};

export const checkIfMentor = (member: GuildMember): void => {
  const mentorIdsHandles = <TextChannel>member.guild.channels.cache.find((channel) => channel.name === 'mentor-ids');
  const eventMentors: string[] = [];
  mentorIdsHandles?.messages
    .fetch({ limit: 100 })
    .then((messages) => {
      messages.every((mesg): boolean => {
        eventMentors.push(mesg.content);
        return true;
      });
    })
    .then(async () => {
      const mentorRole = await BootcampSettings.get('mentor_role');
      let parsedEventMentors: string[] = [];
      eventMentors.forEach((chunk) => {
        parsedEventMentors = parsedEventMentors.concat(chunk.split('\n').map((str) => str.trim()));
      });
      if (parsedEventMentors.includes(member.id) || parsedEventMentors.includes(member.user.tag)) {
        member.edit({
          roles: [mentorRole]
        });
      }
    }).catch(console.log);
};

export const controlMentorMenteeCalls = (oldMember: VoiceState, newMember: VoiceState): void => {
  const guild = oldMember.guild;
  const newUserChannel = newMember.channel;
  const oldUserChannel = oldMember.channel;

  if (newUserChannel === oldUserChannel) return;

  if (newUserChannel !== null) {
    const queueChannel = <TextChannel>(
      guild.channels.cache
        .filter((channel) => channel.name === newUserChannel?.name.replace(/ +/g, '-').toLocaleLowerCase() + '-queue')
        .first()
    );
    queueChannel?.send(newMember.id);
  }

  if (oldUserChannel !== null) {
    const chatChannel = <TextChannel>(
      oldUserChannel?.parent?.children.find(
        (channel: GuildChannel) => channel.name === oldUserChannel?.name.replace(/ +/g, '-').toLocaleLowerCase() + '-vc'
      )
    );
    const leaver = <GuildMember>oldMember.member;

    if (chatChannel) {
      const getMentorRole = BootcampSettings.get('mentor_role');
      getMentorRole?.then((mentorRole: string) => {
        if (
          leaver.roles.cache.map((role) => role.id).includes(mentorRole) &&
          oldUserChannel.members.filter((member: GuildMember) => member.roles.cache.map((role) => role.id).includes(mentorRole))
            .size === 0
        ) {
          chatChannel.delete();
          oldUserChannel.delete();
        } else {
          chatChannel?.updateOverwrite(leaver, {
            VIEW_CHANNEL: false
          });
          (async (): Promise<void> => {
            const fetched = await chatChannel.messages.fetch({ limit: 100 }).catch(console.log);
            if (fetched) chatChannel.bulkDelete(fetched);
          })();
        }
      })
    }

    const queueChannel = <TextChannel>(
      guild.channels.cache
        .filter((channel: GuildChannel) => channel.name === oldUserChannel?.name.replace(/ +/g, '-').toLocaleLowerCase() + '-queue')
        .first()
    );
    const clear = async (): Promise<void> => {
      const fetched = await queueChannel.messages.fetch({ limit: 100 }).catch(console.log);
      if (fetched) {
        const filtered = fetched.filter((msg) => msg.content === newMember.id);
        queueChannel.bulkDelete(filtered);
      }
    };
    if (queueChannel) clear();
  }
};

