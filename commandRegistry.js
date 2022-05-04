module.exports = {
    commands: [
        {
            name: 'ping',
            description: 'See if the bot is responding to commands.'
        },
        {
            name: 'see-match',
            description: 'Post the match info into the channel of the match again.'
        },
        {
            name: "leaderboard",
            description: "See the top 20 players, arranged by ELO."
        },
        {
            name: 'profile',
            description: "View your profile, or someone else's profile.",
            options: [
                {
                    name: "user",
                    description: "A user whos profile you'd like to see.",
                    type: 6
                }
            ]
        },
        {
            name: "remove-from-queue",
            description: "Remove a user from a queue.",
            options: [
                {
                    name: "queue-name",
                    description: "The name of the queue to remove from. Capitalization matters.",
                    required: true,
                    type: 3
                },
                {
                    name: "user",
                    description: "The user to remove from the queue",
                    required: true,
                    type: 6
                }
            ]
        },
        {
            name: 'set-elo',
            description: "Set a player's elo to a given amount.",
            options: [
                {
                    name: "user",
                    description: "The user involved.",
                    required: true,
                    type: 6
                },
                {
                    name: "elo",
                    description: "The elo a player should have.",
                    required: true,
                    type: 4
                }
            ]
        },
        {
            name: 'setup-queue',
            description: 'Set up a queue.',
            options: [
                {
                    name: "capacity",
                    description: "Total number of players to host.",
                    required: true,
                    type: 4
                },
                {
                    name: "name",
                    description: "Title of the queue.",
                    required: true,
                    type: 3
                },
                {
                    name: "game",
                    description: "Game being played.",
                    required: true,
                    type: 3
                },
                {
                    name: "team-sort-mode",
                    description: "ELO or CAPTAINS",
                    required: true,
                    type: 3
                }
            ]
        },
        {
            name: 'add-map',
            description: 'Add a map to the queue.',
            options: [
                {
                    name: 'queue-name',
                    description: 'Title of the queue.',
                    required: true,
                    type: 3
                },
                {
                    name: 'name',
                    description: 'Title of map.',
                    required: true,
                    type: 3
                },
                {
                    name: 'game',
                    description: 'Name of game for the map.',
                    required: true,
                    type: 3
                },
                {
                    name: 'image-url',
                    description: 'Link to an image of the map.',
                    required: true,
                    type: 3
                }
            ]
        },
        {
            name: 'simulate',
            description: 'Simulate the queue.',
            options: [
                {
                    name: 'queue-name',
                    description: 'Title of the queue.',
                    required: true,
                    type: 3
                },
                {
                    name: 'users',
                    description: 'Number of users to add to queue.',
                    required: true,
                    type: 4
                }
            ]
        },
        {
            name: 'see-maps',
            description: 'See the maps in the queue.',
            options: [
                {
                    name: 'queue-name',
                    description: 'Title of the queue.',
                    required: true,
                    type: 3
                },
            ]
        },
        {
            name: 'clear-queue',
            description: 'Clear the queue.',
            options: [
                {
                    name: 'queue-name',
                    description: 'Title of the queue',
                    required: true,
                    type: 3
                }
            ]
        }
    ]
}