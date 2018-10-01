// By default, the client will authenticate using the service account file
// specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable and use
// the project specified by the GCLOUD_PROJECT environment variable. See
// https://googlecloudplatform.github.io/google-cloud-node/#/docs/datastore/latest/guides/authentication
const Datastore = require('@google-cloud/datastore');

const mdcProto = require('../proto/mdc.pb').mdc.proto;
const ShieldState = mdcProto.ShieldState;

class CloudDatastore {
  constructor() {
    /**
     * @type {!Datastore}
     * @private
     */
    this.datastore_ = new Datastore({});

    /**
     * @type {!Key}
     * @private
     */
    this.statusKey_ = this.datastore_.key('ScreenshotStatus');
  }

  /**
   * @param {string} gitRef
   * @param {?ShieldState=} shieldState
   * @return {!Promise<!Object>}
   */
  async getStatus(gitRef, shieldState = undefined) {
    const query = this.datastore_.createQuery(this.statusKey_.kind);

    query
      .filter('git_branch', '=', gitRef)
      // .filter('git_commit_hash', '=', gitRef)
    ;

    if (shieldState) {
      query.filter('state', '=', ShieldState[shieldState]);
    }

    query
      .order('git_commit_timestamp', {descending: true})
      .order('event_timestamp', {descending: true})
    ;

    // runQuery returns an array: [resultArray, cursorInfoObject]
    const statusArray = (await this.datastore_.runQuery(query))[0];
    console.log('statusArray:', statusArray);

    return statusArray[0];
  }

  /**
   * @param {!mdc.proto.ShieldState} state
   * @param {number} numScreenshotsTotal
   * @param {number} numScreenshotsFinished
   * @param {number} numDiffs
   * @param {string} targetUrl
   * @param {!mdc.proto.GitRevision} snapshotGitRev
   * @return {!Promise<void>}
   */
  async setStatusManual({
    state,
    numScreenshotsTotal,
    numScreenshotsFinished,
    numDiffs,
    targetUrl,
    snapshotGitRev,
  }) {
    const entity = {
      key: this.statusKey_,
      data: [
        {
          name: 'event_timestamp',
          value: new Date().toJSON(),
        },
        {
          name: 'git_commit_timestamp',
          value: snapshotGitRev.author.date,
        },
        {
          name: 'git_commit_hash',
          value: snapshotGitRev.commit,
          excludeFromIndexes: true,
        },
        {
          name: 'git_branch',
          value: snapshotGitRev.branch,
        },
        {
          name: 'num_diffs',
          value: numDiffs,
          excludeFromIndexes: true,
        },
        {
          name: 'num_screenshots_finished',
          value: numScreenshotsFinished,
          excludeFromIndexes: true,
        },
        {
          name: 'num_screenshots_total',
          value: numScreenshotsTotal,
          excludeFromIndexes: true,
        },
        {
          name: 'state',
          value: ShieldState[state],
        },
        {
          name: 'target_url',
          value: targetUrl,
          excludeFromIndexes: true,
        },
      ],
    };

    console.log(entity);

    return this.datastore_
      .save(entity)
      .then(
        () => {
          console.log(`Status ${this.statusKey_.id} created successfully.`);
        },
        (err) => {
          console.error('ERROR:', err);
        }
      );
  }
}

module.exports = CloudDatastore;
