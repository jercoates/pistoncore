All great things to research. Let me give you a focused list:
On the Docker side:
The Docker container will run Alpine Linux — it's the standard base for small efficient Docker containers. You don't need to learn Alpine deeply, just know that's what's under the hood. What's worth researching:

How to manually add a Docker container in Unraid — in Unraid go to the Docker tab, click "Add Container" at the bottom. There are YouTube videos specifically for this. Search "Unraid add Docker container manually" — SpaceinvaderOne on YouTube is the gold standard for Unraid tutorials and almost certainly has a video on this
Docker volumes in Unraid — how Unraid maps folders on your array into a container. This is how PistonCore will store your pistons persistently. Search "Unraid Docker volumes explained"
Docker port mapping in Unraid — how to expose the container's port 7777 to your network so you can open it in a browser

On the Home Assistant API side:
This is actually the more important research because it's what makes PistonCore work. HA has two APIs worth understanding:

HA REST API — search "Home Assistant REST API documentation". The key endpoints we need are /api/states which returns all entities and their current states, and /api/services which returns all available services. You can actually test this right now in your browser or with a tool called Postman
HA Long Lived Access Tokens — search "Home Assistant long lived access token". This is how PistonCore will authenticate with your HA. You create one in your HA profile page. Worth creating a test one now so you understand the process
HA WebSocket API — search "Home Assistant WebSocket API". This is more advanced but worth knowing exists — it lets you subscribe to state changes in real time rather than polling

A practical exercise worth doing before next session:
You can actually test the HA API right now without writing any code. Open a browser and go to:
http://192.168.1.10:8123/api/states
It will ask for authentication — that's where the long lived access token comes in. If you get that working you'll see a massive JSON response containing every single entity in your HA instance with all its attributes. That's exactly the data PistonCore will use to populate its dropdowns. Seeing it raw is genuinely useful context for understanding what we're working with.
There's also a built in tool in HA itself — go to your HA instance, click on your username in the bottom left, scroll down to "Long-Lived Access Tokens" and create one called "PistonCore Test". Then go to:
http://192.168.1.10:8123/api/
HA actually has a built in API documentation browser at:
http://192.168.1.10:8123/developer-tools/template
And the states viewer at:
http://192.168.1.10:8123/developer-tools/state
That states viewer is worth spending time in — it shows every entity, its current state, and all its attributes. That's the data model PistonCore is built on top of.
Summary of what to research/do:

Watch a SpaceinvaderOne video on manual Docker containers in Unraid
Understand Docker volumes and port mapping in Unraid
Create a long lived access token in HA
Browse your HA states at the developer tools state page
Try hitting the HA REST API in your browser to see raw entity data

That research will make you a much more informed collaborator when we start writing actual code next session. You'll understand what data we're pulling and how the Docker container fits into your Unraid setup rather than just watching code appear.
Should I update the DESIGN.md development log with today's full summary and next steps before you go?I dont know if this last bit of info is worth putting in the md file.  I might coppy this last into a text file and put it on github as a note for me so i can look into the docker and ha when i have time.  it is more info for me than you.  I might actualy set up a new ha on my server to mess with rather than using my working instance for now and when im stable move on to my working bare bones instance5:41 PMBoth of those are smart decisions.
On saving the research notes separately — you're right, it doesn't belong in DESIGN.md. That file should stay focused on project decisions. A file called NOTES_FOR_JEREMY.md or RESEARCH_NOTES.md in the repo is perfect — it's yours, informal, and keeps the main design doc clean.
On the separate HA instance for development — this is actually the professional way to do it and a really good call. A few thoughts on that:
You have two good options on your Unraid server:

HA in a Docker container on Unraid — lighter weight, easy to spin up and tear down, good for development testing. Search "Home Assistant Docker Unraid" on SpaceinvaderOne's channel
HA in a VM on Unraid — closer to your real bare metal setup, more isolated. Slightly heavier but mirrors your production environment better

Either works. The Docker version is probably faster to get running for development purposes.
The workflow you're describing — develop and test on a throwaway instance, then migrate to production when stable — is exactly right. It means you can break things, test weird pistons, mess with the API connection, and your real home automation never hiccups.
When you're ready to move PistonCore to your real instance it will just be a matter of pointing it at a different HA URL and access token. That's one of the benefits of the design we chose.
Go rest your brain — you did a lot of good thinking today. Update that dev log when you get a chance and we'll hit the ground running next session.Im torn on the docker with ha.  I found it was to bound up for me to use i could not do add ons and running separate dockers for node red never worked5:43 PMThat's a really important experience and you're right to trust it. What you're describing is the difference between HA Container (just the core in Docker, no add-ons, very limited) and HA OS or HA Supervised which is what gives you the full add-on ecosystem.
The reason your current bare metal mini PC setup works so well is exactly because of this — HAOS on dedicated hardware gives you everything without the limitations.
For your development instance your real options are:
A VM on Unraid running HAOS — this is probably your best path. It gives you:

Full add-on support
Isolated from your production instance completely
Can install PyScript, test the companion integration, break things freely
Unraid makes VMs relatively straightforward
When done just delete the VM

Your existing bare metal instance with a separate user/token — less ideal but some people just use their real instance carefully during early development, knowing they're only reading data at first and not deploying real pistons yet
The VM route is the cleaner answer. SpaceinvaderOne has a specific video on running Home Assistant OS as a VM in Unraid — it's one of his most watched videos actually because so many Unraid users want exactly this setup.
The good news is for the very first stages of PistonCore development — building the UI, connecting to the API, reading entity data — we won't be writing any files to HA at all. We're just reading. So even pointing it at your real instance temporarily for early development carries very low risk.
