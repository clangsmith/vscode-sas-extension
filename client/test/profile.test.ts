import {
  Profile,
  ProfileConfig,
  getProfilePrompt,
  ProfilePromptType,
  AuthType,
  EXTENSION_CONFIG_KEY,
  EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
} from "../src/components/profile";
import { expect } from "chai";
import { ConfigurationTarget, workspace } from "vscode";

let testProfileName: string;
let testProfileNewName: string;
let profileConfig: ProfileConfig;
let testProfileClientId;
let testOverloadedProfile;
let testEmptyProfile;
let testEmptyItemsProfile;

async function initProfile(): Promise<void> {
  profileConfig = new ProfileConfig();
}

describe("Profiles", async function () {
  before(async () => {
    await workspace
      .getConfiguration(EXTENSION_CONFIG_KEY)
      .update(
        EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
        undefined,
        ConfigurationTarget.Global
      );
    testProfileClientId = {
      activeProfile: "",
      profiles: {
        testProfile: {
          endpoint: "https://test-host.sas.com",
          clientId: "sas.test",
          clientSecret: "",
          context: "SAS Studio context",
        },
      },
    };
    testEmptyProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {},
      },
    };
    testEmptyItemsProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {
          endpoint: "",
          context: "",
          clientId: "",
          clientSecret: "",
        },
      },
    };
    testOverloadedProfile = {
      activeProfile: "",
      profiles: {
        testProfile: {
          endpoint: "https://test-host.sas.com",
          clientId: "sas.test",
          clientSecret: "",
          context: "SAS Studio context",
          username: "sastest",
          tokenFile: "path/to/token.txt",
        },
      },
    };
  });

  afterEach(async () => {
    if (testProfileName) {
      testProfileName = "";
    }
    if (testProfileNewName) {
      testProfileNewName = "";
    }
  });

  describe("No Profile", async function () {
    beforeEach(async () => {
      testProfileNewName = "testProfile";
      initProfile();
    });
    describe("CRUD Operations", async function () {
      it("validate initial state", async function () {
        // Arrange
        // Act
        const profileLen = await profileConfig.length();

        // Verify
        expect(profileLen).to.equal(0, "No profiles should exist");
      });

      it("add a new profile", async function () {
        // Arrange
        // Act
        await profileConfig.upsertProfile(testProfileNewName, <Profile>{
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
        });
        const profiles = await profileConfig.listProfile();

        // Assert
        expect(profiles).to.have.length(
          1,
          "A single profile should be in the list"
        );
        expect(profiles).to.include(
          testProfileNewName,
          `Profile ${testProfileName} should exist`
        );
      });
    });
  });

  describe("ClientId/Secret Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      testProfileNewName = "testProfile2";
      await initProfile();
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testProfileClientId,
          ConfigurationTarget.Global
        );
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        // Arrange
        // Act
        await profileConfig.upsertProfile(testProfileNewName, <Profile>{
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
        });
        const profilesList = await profileConfig.listProfile();

        // Assert
        expect(profilesList).to.have.length(
          2,
          "A second profile should be in the list"
        );
        expect(profilesList).to.include(
          testProfileNewName,
          `Profile ${testProfileNewName} should exist`
        );
        expect(profilesList).to.include(
          testProfileName,
          `Profile ${testProfileName} should exist`
        );
      });

      it("delete a profile", async function () {
        // Arrange
        // Act
        await profileConfig.deleteProfile(testProfileName);

        // Assert
        const profiles = await profileConfig.listProfile();
        expect(profiles).to.have.length(0);
      });

      it("list the expected profiles", async function () {
        // Arrange
        // Act
        const profileList = profileConfig.listProfile();

        // Assert
        expect(profileList).to.eql(
          [testProfileName],
          "Expected profile name does not exist"
        );
      });

      it("get profile by name", async function () {
        // Arrange
        // Act
        const testProfile = await profileConfig.getProfileByName(
          testProfileName
        );

        // Assert
        expect(testProfile["endpoint"]).to.equal(
          "https://test-host.sas.com",
          "Host is not matching"
        );
        expect(testProfile["clientId"]).to.equal(
          "sas.test",
          "Client ID is not matching"
        );
        expect(testProfile["clientSecret"]).to.equal(
          "",
          "Client Secret is not matching"
        );
        expect(testProfile["context"]).to.equal(
          "SAS Studio context",
          "Compute Context is not matching"
        );
      });

      it("update single element of the profile", async function () {
        // Arrange
        let testProfile = await profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile manually
        testProfile["endpoint"] = "https://test2-host.sas.com";
        await profileConfig.upsertProfile(testProfileName, testProfile);
        testProfile = await profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate host has changed and clientId and token is still empty
        expect(testProfile["endpoint"]).to.equal("https://test2-host.sas.com");
        expect(testProfile["clientId"]).to.equal("sas.test");
        expect(testProfile).to.not.have.any.keys("tokenFile");
      });
    });

    describe("Validate Profile", async function () {
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);

        // Assert
        const testProfile = profileConfig.getActiveProfile();
        expect(testProfileName).to.equal(
          testProfile,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile = profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["endpoint"],
          "https://test-host.sas.com",
          "Active profile endpoint not expected"
        );
      });

      it("validate client id/secret profile", async function () {
        // Arrange
        const profileByName = profileConfig.getProfileByName(testProfileName);

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: profileByName,
        });

        // Assert
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.AuthCode,
          "client id/secret profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          "",
          "client id/secret profile should not return error"
        );
      });
    });
  });

  describe("Empty File Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      testProfileNewName = "testProfile2";
      await initProfile();
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testEmptyProfile,
          ConfigurationTarget.Global
        );
    });
    describe("CRUD Operations", async function () {
      it("add a new profile", async function () {
        // Arrange
        // Act
        await profileConfig.upsertProfile(testProfileNewName, <Profile>{
          endpoint: "https://test-host.sas.com",
          context: "SAS Studio context",
        });
        const profiles = profileConfig.listProfile();

        // Assert
        expect(profiles).to.have.length(
          2,
          "A second profile should be in the list"
        );
        expect(profiles).to.include(
          testProfileNewName,
          `Profile ${testProfileName} should exist`
        );
      });

      it("delete a profile", async function () {
        // Arrange
        // Act
        await profileConfig.deleteProfile(testProfileName);

        // Assert
        const profiles = profileConfig.listProfile();
        expect(profiles).to.have.length(0);
      });

      it("get profile by name", async function () {
        // Arrange
        // Act
        const testProfile = profileConfig.getProfileByName(testProfileName);

        // Assert
        expect(testProfile["endpoint"]).to.equal(
          undefined,
          "Host is not matching"
        );
        expect(testProfile["context"]).to.equal(
          undefined,
          "Compute Context is not matching"
        );
      });

      it("list the expected profiles", async function () {
        // Arrange
        // Act
        const profileList = profileConfig.listProfile();

        // Assert
        expect(profileList).to.eql(
          [testProfileName],
          "Expected profile name does not exist"
        );
      });

      it("update single element of the profile", async function () {
        // Arrange
        let testProfile = profileConfig.getProfileByName(testProfileName);

        // Act
        // update profile manually
        const newProfileSetting = testEmptyProfile;
        newProfileSetting["profiles"][testProfileName]["endpoint"] =
          "https://test2-host.sas.com";
        await workspace
          .getConfiguration(EXTENSION_CONFIG_KEY)
          .update(
            EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
            newProfileSetting,
            ConfigurationTarget.Global
          );
        // get profile after settings update
        testProfile = profileConfig.getProfileByName(testProfileName);

        // Assert
        // validate that endpoint was added
        expect(testProfile["endpoint"]).to.equal("https://test2-host.sas.com");
      });
    });

    describe("Validate Profiles", async function () {
      it("validate no active profile when only name sent in", async function () {
        // Arrange
        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: undefined,
        });

        // Assert
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.Error,
          "No active profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          "No Active Profile",
          "No active profile did not return error"
        );
      });

      it("get active profile when no profile active", async function () {
        // Arrange
        // Act
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile = profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfile).to.be.equal(
          undefined,
          "No active profile should be found"
        );
      });
    });
  });
  describe("Overloaded Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      await initProfile();
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testOverloadedProfile,
          ConfigurationTarget.Global
        );
    });
    describe("Validate Profiles", async function () {
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfile = profileConfig.getActiveProfile();

        // Assert
        expect(activeProfile).to.equal(
          testProfileName,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile = profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["endpoint"],
          "https://test-host.sas.com",
          "Active profile endpoint not expected"
        );
      });

      it("validate overloaded file profile", async function () {
        // Arrange
        const profileByName = profileConfig.getProfileByName(testProfileName);

        // Act
        const validateProfile = await profileConfig.validateProfile({
          name: testProfileName,
          profile: profileByName,
        });

        // Assert
        // Overloaded file should take authcode as precedence
        expect(validateProfile.data).to.equal(undefined);
        expect(validateProfile.type).to.equal(
          AuthType.AuthCode,
          "validate overloaded file profile did not return correct AuthType"
        );
        expect(validateProfile.error).to.equal(
          "",
          "validate overloaded file profile should not return error"
        );
      });
    });
  });

  describe("Empty Item Profile", async function () {
    beforeEach(async () => {
      testProfileName = "testProfile";
      await initProfile();
      await workspace
        .getConfiguration(EXTENSION_CONFIG_KEY)
        .update(
          EXTENSION_DEFINE_PROFILES_CONFIG_KEY,
          testEmptyItemsProfile,
          ConfigurationTarget.Global
        );
    });
    describe("Validate Profiles", async function () {
      it("set active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const testProfile = profileConfig.getActiveProfile();

        // Assert
        expect(testProfile).to.equal(
          testProfileName,
          "Active profile not successfully set"
        );
      });

      it("get active profile", async function () {
        // Arrange
        // Act
        await profileConfig.updateActiveProfileSetting(testProfileName);
        const activeProfileName = profileConfig.getActiveProfile();
        const activeProfile = profileConfig.getProfileByName(activeProfileName);

        // Assert
        expect(activeProfileName).to.equal(
          testProfileName,
          "Active profile has not been set"
        );
        expect(
          activeProfile["endpoint"],
          "",
          "Active profile endpoint not expected"
        );
      });
    });
  });

  describe("Input Prompts", async function () {
    it("Valid Profile Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.Profile);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "Switch Current SAS Profile",
        "Profile title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Select a SAS connection profile",
        "Profile placeholder does not match expected"
      );
    });

    it("Valid New Profile Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.NewProfile);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "New SAS Connection Profile Name",
        "NewProfile title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter connection name",
        "NewProfile placeholder does not match expected"
      );
    });

    it("Valid Endpoint Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.Endpoint);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "SAS Viya Server",
        "Endpoint title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter the URL",
        "Endpoint placeholder does not match expected"
      );
    });

    it("Valid Compute Context Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ComputeContext);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "SAS Compute Context",
        "ComputeContext title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter the SAS compute context",
        "ComputeContext placeholder does not match expected"
      );
    });

    it("Valid Client Id Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ClientId);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "Client ID",
        "ClientId title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter a client ID",
        "ClientId placeholder does not match expected"
      );
    });

    it("Valid Client Secret Input", function () {
      // Arrange
      // Act
      const result = getProfilePrompt(ProfilePromptType.ClientSecret);

      // Assert
      expect(result).to.not.equal(undefined);
      expect(result["title"]).to.equal(
        "Client Secret",
        "ClientSecret title does not match expected"
      );
      expect(result["placeholder"]).to.equal(
        "Enter a client secret",
        "ClientSecret placeholder does not match expected"
      );
    });
  });
});
