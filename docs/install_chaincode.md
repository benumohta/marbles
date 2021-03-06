# Install and Instantiate Chaincode w/Bluemix

1. If you are not currently on the Blockchain "Resources" page... then get there via:
	1. Login to [Bluemix](https://console.ng.bluemix.net) 
	1. Get to your dashboard by clicking the "Menu" icon on the top left and then clicking the "Dashboard" link
	1. Under "All Services" locate your the Blockchain row and click it
	1. Enter your IBM Blockchain Service's dashboard by clicking the "Enter" button

1. If you are on the "Resources" page already, then click the "Chaincode" link on the left navigation

![](/doc_images/9-chaincode.PNG)

- Select 1 of your peers in the drop down
- Now click the "Install Chaincode" button

![](/doc_images/10-install-marbles.PNG)

- Fill out the chaincode name as "marbles"
- Fill out the chaincode version as "v0"
- Select the "Choose Files" button and select **all 5** files found in `<marbles directory>/chaincode/src/marbles`
	- Alternatively you can zip up the 5 .go files and submit a single zip file
- Click "Submit"

![](/doc_images/11-installed-marbles.PNG)

- Great, so you should see marbles listed in the chaincode table for this peer.
- All we've done so far is upload the files ont the peer. Next, we need to tell it what channel to run on.
- Click the "Instantiate" button in the marbles row

![](/doc_images/12-instantiate-marbles.PNG)

- The arguments input box is for entering the arguments we want to pass to our chaincode's Init() function.
- Marbles chaincode is expecting a single integer. Enter your favorite number. Mines 314. 
- Next from the channel list select our 1 and only channel
- Then click the "Submit" button

![](/doc_images/13-instantiated-marbles.PNG)

- Now that the chaincode has been instantiated on the channel, lets look at it
- Click the "Channels" link on the left navigation
- Click the channel you instantiated marbles on
- Click the "Chaincode" tab
- On this panel, you should see something simialr to the picture above.  Marbles is instantiated on both peers and we can click the logs button to see it has started up. 
- The last thing we need to do is grab all the service instance's credentials for our network. We will use this data to inform the marbles node.js application of our blockchain's networking addresses and credentials.
- Get basic service credentials by clicking the "JSON" button
- This will open the JSON in your browser. Copy this data and save/replace the entire contents of the file `<marbles directory>/config/blockchain_creds1.json` 
  - This JSON a simplified version of your Service Credentials.  It has 1 orderer, 1 ca, 1 peer which is all we need for marbles.

### Finish Up

Congrats! The network is all setup and marbles chaincode is running. 

- Continue where you left off in the [tutorial](./tutorial_start_here.md#hostmarbles).


