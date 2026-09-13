(function(Scratch) {
  'use strict';

  // Internal user list database object
  // Format: { username: { password: "...", settings: { role: "...", status: "...", theme: "...", coins: "0", level: "1" } } }
  let userDatabase = {};
  let lastLoggedInUser = "";

  // Auto-load existing database list from JSON string in browser storage
  try {
    const savedData = localStorage.getItem('electramod_localauth_db_v4');
    if (savedData) {
      userDatabase = JSON.parse(savedData);
    }
  } catch (e) {
    console.error("Could not load user list JSON:", e);
  }

  // Helper function to sync changes to browser memory
  function syncDatabase() {
    try {
      localStorage.setItem('electramod_localauth_db_v4', JSON.stringify(userDatabase));
    } catch (e) {
      console.error("Could not save user list JSON:", e);
    }
  }

  class LocalAuthExtension {
    getInfo() {
      return {
        id: 'localauth',
        name: 'LocalAuth',
        color1: '#0284c7', // Global theme: Sky Blue
        color2: '#0369a1',
        blocks: [
          // === CATEGORY LABEL: ACCOUNTS ===
          {
            blockType: Scratch.BlockType.LABEL,
            text: '--- Accounts ---'
          },
          {
            opcode: 'createUser',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Create User [USER] [PASS]',
            arguments: {
              USER: { type: Scratch.ArgumentType.STRING, defaultValue: 'username' },
              PASS: { type: Scratch.ArgumentType.STRING, defaultValue: 'password' }
            }
          },
          {
            opcode: 'deleteUser',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Delete User [USER]',
            arguments: {
              USER: { type: Scratch.ArgumentType.STRING, defaultValue: 'username' }
            }
          },
          {
            opcode: 'loginUser',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Login [USER] [PASS]',
            arguments: {
              USER: { type: Scratch.ArgumentType.STRING, defaultValue: 'username' },
              PASS: { type: Scratch.ArgumentType.STRING, defaultValue: 'password' }
            }
          },
          {
            opcode: 'loginSuccessWith',
            blockType: Scratch.BlockType.REPORTER,
            text: 'Login Success with [USER]',
            arguments: {
              USER: { type: Scratch.ArgumentType.STRING, defaultValue: 'username' }
            }
          },

          // === CATEGORY LABEL: USERDATA ===
          {
            blockType: Scratch.BlockType.LABEL,
            text: '--- UserData ---'
          },
          {
            opcode: 'changeSetting',
            blockType: Scratch.BlockType.COMMAND,
            text: 'change setting [SETTING] of user [USER] to [VALUE]',
            arguments: {
              SETTING: {
                type: Scratch.ArgumentType.STRING,
                menu: 'settingsMenu',
                defaultValue: 'role'
              },
              USER: { type: Scratch.ArgumentType.STRING, defaultValue: 'username' },
              VALUE: { type: Scratch.ArgumentType.STRING, defaultValue: 'admin' }
            }
          },
          {
            opcode: 'addSetting',
            blockType: Scratch.BlockType.COMMAND,
            text: 'add [VALUE] to setting [SETTING] of user [USER]',
            arguments: {
              VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 10 },
              SETTING: {
                type: Scratch.ArgumentType.STRING,
                menu: 'settingsMenu',
                defaultValue: 'coins'
              },
              USER: { type: Scratch.ArgumentType.STRING, defaultValue: 'username' }
            }
          },
          {
            opcode: 'getSetting',
            blockType: Scratch.BlockType.REPORTER,
            text: 'get setting [SETTING] of user [USER]',
            arguments: {
              SETTING: {
                type: Scratch.ArgumentType.STRING,
                menu: 'settingsMenu',
                defaultValue: 'role'
              },
              USER: { type: Scratch.ArgumentType.STRING, defaultValue: 'username' }
            }
          },

          // === CATEGORY LABEL: UTILITIES ===
          {
            blockType: Scratch.BlockType.LABEL,
            text: '--- Utilities ---'
          },
          {
            opcode: 'whenUserLogsIn',
            blockType: Scratch.BlockType.HAT,
            text: 'when user logs in',
            isEdgeActivated: false
          },
          {
            opcode: 'whenUserIsDeleted',
            blockType: Scratch.BlockType.HAT,
            text: 'when user is deleted',
            isEdgeActivated: false
          },
          {
            opcode: 'clearDatabase',
            blockType: Scratch.BlockType.COMMAND,
            text: 'Wipe All Users (Master Reset)'
          }
        ],
        menus: {
          settingsMenu: {
            acceptReporters: true,
            items: ['role', 'status', 'theme', 'coins', 'level']
          }
        }
      };
    }

    whenUserLogsIn() { return true; }
    whenUserIsDeleted() { return true; }

    createUser(args) {
      const username = String(args.USER).trim();
      const password = String(args.PASS);
      if (!username) return;

      if (!userDatabase[username] || typeof userDatabase[username] === 'string') {
        const oldPass = typeof userDatabase[username] === 'string' ? userDatabase[username] : password;
        userDatabase[username] = {
          password: oldPass,
          settings: { role: 'user', status: 'offline', theme: 'default', coins: '0', level: '1' }
        };
      } else {
        userDatabase[username].password = password;
      }
      
      syncDatabase();
    }

    deleteUser(args) {
      const username = String(args.USER).trim();
      if (userDatabase[username]) {
        delete userDatabase[username];
        if (lastLoggedInUser === username) {
          lastLoggedInUser = "";
        }
        syncDatabase();
        Scratch.vm.runtime.startHats('localauth_whenUserIsDeleted');
      }
    }

    loginUser(args) {
      const username = String(args.USER).trim();
      const password = String(args.PASS);

      const storedUserData = userDatabase[username];
      let storedPassword = "";
      
      if (typeof storedUserData === 'string') {
        storedPassword = storedUserData;
      } else if (storedUserData && storedUserData.password) {
        storedPassword = storedUserData.password;
      }

      if (storedUserData && storedPassword === password) {
        lastLoggedInUser = username;
        if (storedUserData.settings) {
          storedUserData.settings.status = 'online';
          syncDatabase();
        }
        Scratch.vm.runtime.startHats('localauth_whenUserLogsIn');
      } else {
        if (lastLoggedInUser === username) {
          lastLoggedInUser = "";
        }
      }
    }

    changeSetting(args) {
      const username = String(args.USER).trim();
      const setting = String(args.SETTING).toLowerCase();
      const value = String(args.VALUE);

      if (userDatabase[username]) {
        if (typeof userDatabase[username] === 'string') {
          userDatabase[username] = {
            password: userDatabase[username],
            settings: { role: 'user', status: 'offline', theme: 'default', coins: '0', level: '1' }
          };
        }
        if (!userDatabase[username].settings) {
          userDatabase[username].settings = { role: 'user', status: 'offline', theme: 'default', coins: '0', level: '1' };
        }
        
        userDatabase[username].settings[setting] = value;
        syncDatabase();
      }
    }

    addSetting(args) {
      const username = String(args.USER).trim();
      const setting = String(args.SETTING).toLowerCase();
      const amountToAdd = Number(args.VALUE) || 0;

      if (userDatabase[username]) {
        // Enforce structural data migration if legacy profile structure detected
        if (typeof userDatabase[username] === 'string') {
          userDatabase[username] = {
            password: userDatabase[username],
            settings: { role: 'user', status: 'offline', theme: 'default', coins: '0', level: '1' }
          };
        }
        if (!userDatabase[username].settings) {
          userDatabase[username].settings = { role: 'user', status: 'offline', theme: 'default', coins: '0', level: '1' };
        }

        // Fetch current value, turn into a real number to safely add math together, then compute
        const currentValue = Number(userDatabase[username].settings[setting]) || 0;
        userDatabase[username].settings[setting] = String(currentValue + amountToAdd);
        
        syncDatabase();
      }
    }

    getSetting(args) {
      const username = String(args.USER).trim();
      const setting = String(args.SETTING).toLowerCase();

      if (userDatabase[username] && userDatabase[username].settings) {
        return userDatabase[username].settings[setting] || "";
      }
      return "";
    }

    loginSuccessWith(args) {
      const username = String(args.USER).trim();
      return lastLoggedInUser === username ? "true" : "false";
    }

    clearDatabase() {
      userDatabase = {};
      lastLoggedInUser = "";
      syncDatabase();
    }
  }

  Scratch.extensions.register(new LocalAuthExtension());
})(Scratch);
