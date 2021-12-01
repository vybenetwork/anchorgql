gcloud config set project vybe-network
gcloud builds submit --tag gcr.io/vybe-network/__IMAGENAME__:latest 

gcloud alpha run deploy __CLOUDRUNSERVICENAME__ --allow-unauthenticated \
--image  gcr.io/vybe-network/__IMAGENAME__:latest \
--platform managed --region us-central1 \

gcloud beta run services add-iam-policy-binding --region=us-central1 --member=allUsers --role=roles/run.invoker __CLOUDRUNSERVICENAME__